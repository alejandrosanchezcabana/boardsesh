import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('server-only', () => ({}));

const mockGetServerSession = vi.fn();
vi.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock('@/app/lib/auth/auth-options', () => ({
  authOptions: {},
}));

const mockCheckRateLimit = vi.fn();
const mockGetClientIp = vi.fn();
vi.mock('@/app/lib/auth/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock('@/app/lib/db/db', () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  }),
}));

vi.mock('@/app/lib/db/schema', () => ({
  userBoards: {
    id: 'userBoards.id',
    uuid: 'userBoards.uuid',
    ownerId: 'userBoards.ownerId',
    serialNumber: 'userBoards.serialNumber',
    deletedAt: 'userBoards.deletedAt',
    isPublic: 'userBoards.isPublic',
  },
  userBoardSerials: {
    userId: 'userBoardSerials.userId',
    serialNumber: 'userBoardSerials.serialNumber',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _type: 'eq', col, val })),
  isNull: vi.fn((col: unknown) => ({ _type: 'isNull', col })),
  or: vi.fn((...args: unknown[]) => ({ _type: 'or', args })),
}));

function createRequest(body: unknown, raw?: string): NextRequest {
  return new NextRequest('http://localhost/api/internal/board-serials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
}

const validBody = {
  serialNumber: 'KB-12345',
  boardName: 'kilter',
  layoutId: 1,
  sizeId: 10,
  setIds: '1,20',
};

describe('POST /api/internal/board-serials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ limited: false, retryAfterSeconds: 0 });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]); // no saved board by default

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 429 when IP rate limited', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockCheckRateLimit.mockReturnValueOnce({ limited: true, retryAfterSeconds: 30 });

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 429 when user rate limited', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockCheckRateLimit
      .mockReturnValueOnce({ limited: false, retryAfterSeconds: 0 })
      .mockReturnValueOnce({ limited: true, retryAfterSeconds: 45 });

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed JSON', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const request = new NextRequest('http://localhost/api/internal/board-serials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid request body');
  });

  it('returns 400 when serialNumber is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const { serialNumber: _drop, ...rest } = validBody;
    void _drop;
    const response = await POST(createRequest(rest));
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 400 when boardName is not in AURORA_BOARDS', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(createRequest({ ...validBody, boardName: 'moonboard' }));
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 400 when serialNumber exceeds 64 characters', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(createRequest({ ...validBody, serialNumber: 'A'.repeat(65) }));
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 400 when setIds exceeds 256 characters', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(createRequest({ ...validBody, setIds: '1,'.repeat(200) }));
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('upserts and returns 200 on happy path with no boardUuid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        serialNumber: 'KB-12345',
        boardName: 'kilter',
        layoutId: 1,
        sizeId: 10,
        setIds: '1,20',
        boardUuid: null,
      }),
    );
  });

  it('drops boardUuid when the user neither owns it nor it is public', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    // First select (savedMatch by serial) → no match. Second select (boardUuid
    // validation) → no match either, so the link must be silently dropped.
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const response = await POST(createRequest({ ...validBody, boardUuid: 'someones-board-uuid' }));
    expect(response.status).toBe(200);

    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ boardUuid: null }));
  });

  it('preserves boardUuid when the user owns the board', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    // savedMatch → empty; boardUuid validation → finds an allowed board row.
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ uuid: 'my-own-board' }]);

    const response = await POST(createRequest({ ...validBody, boardUuid: 'my-own-board' }));
    expect(response.status).toBe(200);

    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ boardUuid: 'my-own-board' }));
  });

  it('preserves boardUuid when the board is public (e.g. gym board)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ uuid: 'public-gym-board' }]);

    const response = await POST(createRequest({ ...validBody, boardUuid: 'public-gym-board' }));
    expect(response.status).toBe(200);

    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ boardUuid: 'public-gym-board' }));
  });

  it('short-circuits and skips upsert when saved board already exists for this serial', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockLimit.mockResolvedValue([{ id: 42 }]); // saved board found

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: 'already_saved' });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockOnConflictDoUpdate.mockRejectedValue(new Error('DB exploded'));

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import type { ConnectionContext } from '@boardsesh/shared-schema';

const { mockDb, mockIsBunnyStreamConfigured, mockCreateBunnyVideo, mockGetTusUploadCredentials, mockDeleteBunnyVideo } =
  vi.hoisted(() => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: insertValuesMock,
      }),
      select: vi.fn(),
      delete: vi.fn(),
      _insertValuesMock: insertValuesMock,
    };

    return {
      mockDb,
      mockIsBunnyStreamConfigured: vi.fn().mockReturnValue(true),
      mockCreateBunnyVideo: vi
        .fn()
        .mockResolvedValue({ guid: 'bunny-video-guid', title: 'Test', status: 0, length: 0, thumbnailFileName: '' }),
      mockGetTusUploadCredentials: vi.fn().mockResolvedValue({
        uploadUrl: 'https://video.bunnycdn.com/tusupload',
        authorizationSignature: 'sig-abc',
        authorizationExpire: 1700000000,
        videoId: 'bunny-video-guid',
        libraryId: 'lib-123',
      }),
      mockDeleteBunnyVideo: vi.fn().mockResolvedValue(undefined),
    };
  });

vi.mock('../db/client', () => ({
  db: mockDb,
}));

vi.mock('../lib/bunny-stream', () => ({
  isBunnyStreamConfigured: mockIsBunnyStreamConfigured,
  createBunnyVideo: mockCreateBunnyVideo,
  getTusUploadCredentials: mockGetTusUploadCredentials,
  deleteBunnyVideo: mockDeleteBunnyVideo,
}));

vi.mock('../utils/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('../utils/redis-rate-limiter', () => ({
  checkRateLimitRedis: vi.fn().mockResolvedValue(undefined),
}));

import { betaVideoMutations } from '../graphql/resolvers/beta-videos/mutations';

function makeCtx(overrides: Partial<ConnectionContext> = {}): ConnectionContext {
  return {
    connectionId: 'conn-1',
    isAuthenticated: true,
    userId: 'user-123',
    sessionId: null,
    boardPath: null,
    controllerId: null,
    controllerApiKey: null,
    ...overrides,
  } as ConnectionContext;
}

describe('createBetaVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBunnyStreamConfigured.mockReturnValue(true);
    mockDb._insertValuesMock.mockResolvedValue(undefined);
    process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123';
  });

  it('requires authentication', async () => {
    const ctx = makeCtx({ isAuthenticated: false });

    await expect(
      betaVideoMutations.createBetaVideo(
        undefined,
        { input: { boardType: 'kilter', climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
        ctx,
      ),
    ).rejects.toThrow('Authentication required');
  });

  it('validates input with Zod schema - rejects invalid boardType', async () => {
    const ctx = makeCtx();

    await expect(
      betaVideoMutations.createBetaVideo(
        undefined,
        { input: { boardType: 'invalid-board', climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
        ctx,
      ),
    ).rejects.toThrow();
  });

  it('returns error when Bunny is not configured', async () => {
    mockIsBunnyStreamConfigured.mockReturnValue(false);
    const ctx = makeCtx();

    await expect(
      betaVideoMutations.createBetaVideo(
        undefined,
        { input: { boardType: 'kilter', climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
        ctx,
      ),
    ).rejects.toThrow('Beta video uploads are not configured');
  });

  it('creates video in Bunny, inserts DB row, returns TUS credentials', async () => {
    const ctx = makeCtx();

    const result = await betaVideoMutations.createBetaVideo(
      undefined,
      { input: { boardType: 'kilter', climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'My Beta' } },
      ctx,
    );

    // Should have called createBunnyVideo with the title
    expect(mockCreateBunnyVideo).toHaveBeenCalledWith('My Beta');

    // Should have inserted a DB row
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb._insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        boardType: 'kilter',
        climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        bunnyVideoId: 'bunny-video-guid',
        bunnyLibraryId: 'lib-123',
        title: 'My Beta',
        status: 'processing',
      }),
    );

    // Should have fetched TUS credentials
    expect(mockGetTusUploadCredentials).toHaveBeenCalledWith('bunny-video-guid');

    // Should return TUS credentials plus the generated uuid
    expect(result).toEqual(
      expect.objectContaining({
        uuid: expect.any(String),
        uploadUrl: 'https://video.bunnycdn.com/tusupload',
        authorizationSignature: 'sig-abc',
        authorizationExpire: 1700000000,
        videoId: 'bunny-video-guid',
        libraryId: 'lib-123',
      }),
    );
  });

  it('cleans up Bunny video if DB insert fails', async () => {
    const ctx = makeCtx();
    const dbError = new Error('DB insert failed');
    mockDb._insertValuesMock.mockRejectedValueOnce(dbError);

    await expect(
      betaVideoMutations.createBetaVideo(
        undefined,
        { input: { boardType: 'kilter', climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
        ctx,
      ),
    ).rejects.toThrow('DB insert failed');

    // Should have attempted to delete the Bunny video
    expect(mockDeleteBunnyVideo).toHaveBeenCalledWith('bunny-video-guid');
  });
});

describe('deleteBetaVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockSelectChain(resolveValue: unknown = []): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const methods = ['from', 'where', 'leftJoin', 'limit'];

    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);

    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }

    return chain;
  }

  function createMockDeleteChain(): { where: ReturnType<typeof vi.fn> } {
    return {
      where: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('requires authentication', async () => {
    const ctx = makeCtx({ isAuthenticated: false });

    await expect(betaVideoMutations.deleteBetaVideo(undefined, { uuid: 'video-uuid' }, ctx)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('returns error if video not found', async () => {
    const ctx = makeCtx();
    mockDb.select.mockReturnValueOnce(createMockSelectChain([]));

    await expect(betaVideoMutations.deleteBetaVideo(undefined, { uuid: 'nonexistent' }, ctx)).rejects.toThrow(
      'Beta video not found',
    );
  });

  it('returns error if user does not own the video', async () => {
    const ctx = makeCtx({ userId: 'user-123' });
    mockDb.select.mockReturnValueOnce(
      createMockSelectChain([
        {
          uuid: 'video-uuid',
          userId: 'other-user',
          bunnyVideoId: 'bunny-vid',
          boardType: 'kilter',
          climbUuid: 'climb-uuid',
          status: 'ready',
        },
      ]),
    );

    await expect(betaVideoMutations.deleteBetaVideo(undefined, { uuid: 'video-uuid' }, ctx)).rejects.toThrow(
      'You can only delete your own beta videos',
    );
  });

  it('deletes from both Bunny and DB', async () => {
    const ctx = makeCtx({ userId: 'user-123' });
    const deleteChain = createMockDeleteChain();

    mockDb.select.mockReturnValueOnce(
      createMockSelectChain([
        {
          uuid: 'video-uuid',
          userId: 'user-123',
          bunnyVideoId: 'bunny-vid-to-delete',
          boardType: 'kilter',
          climbUuid: 'climb-uuid',
          status: 'ready',
        },
      ]),
    );
    mockDb.delete.mockReturnValueOnce(deleteChain);

    const result = await betaVideoMutations.deleteBetaVideo(undefined, { uuid: 'video-uuid' }, ctx);

    expect(result).toBe(true);
    expect(mockDeleteBunnyVideo).toHaveBeenCalledWith('bunny-vid-to-delete');
    expect(mockDb.delete).toHaveBeenCalled();
    expect(deleteChain.where).toHaveBeenCalled();
  });

  it('handles Bunny deletion failure gracefully - still deletes from DB', async () => {
    const ctx = makeCtx({ userId: 'user-123' });
    const deleteChain = createMockDeleteChain();

    mockDb.select.mockReturnValueOnce(
      createMockSelectChain([
        {
          uuid: 'video-uuid',
          userId: 'user-123',
          bunnyVideoId: 'bunny-vid-fail',
          boardType: 'kilter',
          climbUuid: 'climb-uuid',
          status: 'ready',
        },
      ]),
    );
    mockDeleteBunnyVideo.mockRejectedValueOnce(new Error('Bunny API error'));
    mockDb.delete.mockReturnValueOnce(deleteChain);

    const result = await betaVideoMutations.deleteBetaVideo(undefined, { uuid: 'video-uuid' }, ctx);

    // Should still succeed and delete from DB
    expect(result).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(deleteChain.where).toHaveBeenCalled();
  });
});

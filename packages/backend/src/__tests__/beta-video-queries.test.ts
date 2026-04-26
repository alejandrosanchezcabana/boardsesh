import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

const {
  mockDb,
  mockIsBunnyStreamConfigured,
  mockGetBunnyThumbnailUrl,
  mockGetBunnyPlaybackUrl,
  mockGetBunnyVideoStatus,
  mockDeleteBunnyVideo,
} = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  };

  return {
    mockDb,
    mockIsBunnyStreamConfigured: vi.fn().mockReturnValue(true),
    mockGetBunnyThumbnailUrl: vi.fn((videoId: string) => `https://cdn.test/${videoId}/thumbnail.jpg`),
    mockGetBunnyPlaybackUrl: vi.fn((videoId: string) => `https://cdn.test/${videoId}/playlist.m3u8`),
    mockGetBunnyVideoStatus: vi.fn(),
    mockDeleteBunnyVideo: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../db/client', () => ({
  db: mockDb,
}));

vi.mock('../lib/bunny-stream', () => ({
  isBunnyStreamConfigured: mockIsBunnyStreamConfigured,
  getBunnyThumbnailUrl: mockGetBunnyThumbnailUrl,
  getBunnyPlaybackUrl: mockGetBunnyPlaybackUrl,
  getBunnyVideoStatus: mockGetBunnyVideoStatus,
  deleteBunnyVideo: mockDeleteBunnyVideo,
}));

vi.mock('../utils/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('../utils/redis-rate-limiter', () => ({
  checkRateLimitRedis: vi.fn().mockResolvedValue(undefined),
}));

// Must import AFTER mocks are set up
import { betaVideoQueries } from '../graphql/resolvers/beta-videos/queries';

function createMockSelectChain(resolveValue: unknown = []): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'where', 'leftJoin', 'limit'];

  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
}

function createMockUpdateChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

describe('betaVideos query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBunnyStreamConfigured.mockReturnValue(true);
  });

  it('returns empty array when Bunny is not configured', async () => {
    mockIsBunnyStreamConfigured.mockReturnValue(false);

    const result = await betaVideoQueries.betaVideos(undefined, {
      boardType: 'kilter',
      climbUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });

    expect(result).toEqual([]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns ready videos with playback URLs', async () => {
    const readyRow = {
      uuid: 'video-1',
      userId: 'user-1',
      boardType: 'kilter',
      climbUuid: 'climb-1',
      angle: 40,
      bunnyVideoId: 'bunny-1',
      status: 'ready',
      thumbnailUrl: 'https://cdn.test/bunny-1/thumbnail.jpg',
      duration: 30,
      createdAt: '2024-01-01T00:00:00Z',
      userName: 'Test User',
      userImage: null,
      profileDisplayName: 'TestUser',
      profileAvatarUrl: null,
    };

    mockDb.select.mockReturnValueOnce(createMockSelectChain([readyRow]));

    const result = await betaVideoQueries.betaVideos(undefined, {
      boardType: 'kilter',
      climbUuid: 'climb-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uuid: 'video-1',
      status: 'ready',
      thumbnailUrl: 'https://cdn.test/bunny-1/thumbnail.jpg',
      playbackUrl: 'https://cdn.test/bunny-1/playlist.m3u8',
      userDisplayName: 'TestUser',
    });
  });

  it('excludes failed videos', async () => {
    // The query uses ne(status, 'failed') in the WHERE clause,
    // so failed videos should not be in the returned rows.
    // If a processing video transitions to failed during sync, it is filtered out.
    const processingRow = {
      uuid: 'video-2',
      userId: 'user-1',
      boardType: 'kilter',
      climbUuid: 'climb-1',
      angle: 40,
      bunnyVideoId: 'bunny-2',
      status: 'processing',
      thumbnailUrl: null,
      duration: null,
      createdAt: '2024-01-01T00:00:00Z',
      userName: 'Test User',
      userImage: null,
      profileDisplayName: null,
      profileAvatarUrl: null,
    };

    mockDb.select.mockReturnValueOnce(createMockSelectChain([processingRow]));
    // Simulate Bunny returning failed status
    mockGetBunnyVideoStatus.mockResolvedValueOnce({ guid: 'bunny-2', status: 5, length: 0 });
    mockDb.update.mockReturnValueOnce(createMockUpdateChain());

    const result = await betaVideoQueries.betaVideos(undefined, {
      boardType: 'kilter',
      climbUuid: 'climb-1',
    });

    // Failed video should be filtered out
    expect(result).toHaveLength(0);
  });

  it('syncs processing videos via Bunny API', async () => {
    const processingRow = {
      uuid: 'video-3',
      userId: 'user-1',
      boardType: 'kilter',
      climbUuid: 'climb-1',
      angle: 40,
      bunnyVideoId: 'bunny-3',
      status: 'processing',
      thumbnailUrl: null,
      duration: null,
      createdAt: '2024-01-01T00:00:00Z',
      userName: 'Test User',
      userImage: null,
      profileDisplayName: 'Climber',
      profileAvatarUrl: null,
    };

    mockDb.select.mockReturnValueOnce(createMockSelectChain([processingRow]));
    // Simulate Bunny returning ready status
    mockGetBunnyVideoStatus.mockResolvedValueOnce({ guid: 'bunny-3', status: 4, length: 30 });
    mockDb.update.mockReturnValueOnce(createMockUpdateChain());

    const result = await betaVideoQueries.betaVideos(undefined, {
      boardType: 'kilter',
      climbUuid: 'climb-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uuid: 'video-3',
      status: 'ready',
      playbackUrl: 'https://cdn.test/bunny-3/playlist.m3u8',
    });
    expect(mockGetBunnyVideoStatus).toHaveBeenCalledWith('bunny-3');
  });

  it('rejects videos over 60s during sync', async () => {
    const processingRow = {
      uuid: 'video-4',
      userId: 'user-1',
      boardType: 'kilter',
      climbUuid: 'climb-1',
      angle: 40,
      bunnyVideoId: 'bunny-4',
      status: 'processing',
      thumbnailUrl: null,
      duration: null,
      createdAt: '2024-01-01T00:00:00Z',
      userName: 'Test User',
      userImage: null,
      profileDisplayName: null,
      profileAvatarUrl: null,
    };

    mockDb.select.mockReturnValueOnce(createMockSelectChain([processingRow]));
    // Simulate Bunny returning ready but over 60s
    mockGetBunnyVideoStatus.mockResolvedValueOnce({ guid: 'bunny-4', status: 4, length: 90 });
    // Mock DB update for marking as failed
    mockDb.update.mockReturnValueOnce(createMockUpdateChain());

    const result = await betaVideoQueries.betaVideos(undefined, {
      boardType: 'kilter',
      climbUuid: 'climb-1',
    });

    // Video should be filtered out because it was marked as failed
    expect(result).toHaveLength(0);
    // Should have tried to delete the video from Bunny
    expect(mockDeleteBunnyVideo).toHaveBeenCalledWith('bunny-4');
  });
});

describe('betaVideo query (single)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBunnyStreamConfigured.mockReturnValue(true);
  });

  it('returns null when not configured', async () => {
    mockIsBunnyStreamConfigured.mockReturnValue(false);

    const result = await betaVideoQueries.betaVideo(undefined, { uuid: 'some-uuid' });

    expect(result).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns null when video not found', async () => {
    mockDb.select.mockReturnValueOnce(createMockSelectChain([]));

    const result = await betaVideoQueries.betaVideo(undefined, { uuid: 'nonexistent' });

    expect(result).toBeNull();
  });

  it('syncs processing status on single video query', async () => {
    const processingRow = {
      uuid: 'video-single',
      userId: 'user-1',
      boardType: 'kilter',
      climbUuid: 'climb-1',
      angle: 40,
      bunnyVideoId: 'bunny-single',
      status: 'processing',
      thumbnailUrl: null,
      duration: null,
      createdAt: '2024-01-01T00:00:00Z',
      userName: 'Climber',
      userImage: null,
      profileDisplayName: null,
      profileAvatarUrl: null,
    };

    mockDb.select.mockReturnValueOnce(createMockSelectChain([processingRow]));
    mockGetBunnyVideoStatus.mockResolvedValueOnce({ guid: 'bunny-single', status: 3, length: 20 });
    mockDb.update.mockReturnValueOnce(createMockUpdateChain());

    const result = await betaVideoQueries.betaVideo(undefined, { uuid: 'video-single' });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('ready');
    expect(result!.playbackUrl).toBe('https://cdn.test/bunny-single/playlist.m3u8');
    expect(result!.thumbnailUrl).toBe('https://cdn.test/bunny-single/thumbnail.jpg');
    expect(mockGetBunnyVideoStatus).toHaveBeenCalledWith('bunny-single');
  });
});

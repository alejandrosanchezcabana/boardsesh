import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test';

const {
  selectMock,
  updateMock,
  fetchInstagramMetaMock,
  fetchTikTokMetaMock,
  cacheInstagramMock,
  cacheTikTokMock,
  isS3ConfiguredMock,
  getPublicUrlMock,
} = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  fetchInstagramMetaMock: vi.fn(),
  fetchTikTokMetaMock: vi.fn(),
  cacheInstagramMock: vi.fn(),
  cacheTikTokMock: vi.fn(),
  isS3ConfiguredMock: vi.fn(() => true),
  getPublicUrlMock: vi.fn((key: string) => `https://bucket.example.com/${key}`),
}));

vi.mock('../db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectMock()),
      }),
    }),
    update: () => ({
      set: () => ({
        where: (...args: unknown[]) => {
          updateMock(...args);
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock('../lib/instagram-meta', async () => {
  const shared = await vi.importActual<typeof import('@boardsesh/shared-schema')>('@boardsesh/shared-schema');
  return {
    fetchInstagramMeta: fetchInstagramMetaMock,
    isInstagramUrl: shared.isInstagramUrl,
    getInstagramMediaId: shared.getInstagramMediaId,
  };
});

vi.mock('../lib/tiktok-meta', async () => {
  const shared = await vi.importActual<typeof import('@boardsesh/shared-schema')>('@boardsesh/shared-schema');
  return {
    fetchTikTokMeta: fetchTikTokMetaMock,
    isTikTokUrl: shared.isTikTokUrl,
    getTikTokCacheId: (url: string) => shared.getTikTokVideoId(url) ?? null,
  };
});

vi.mock('../storage/s3', () => ({
  isS3Configured: isS3ConfiguredMock,
  getPublicUrl: getPublicUrlMock,
  uploadToS3: vi.fn(),
}));

vi.mock('../lib/beta-link-thumbnails', async () => {
  const actual = await vi.importActual<typeof import('../lib/beta-link-thumbnails')>('../lib/beta-link-thumbnails');
  return {
    ...actual,
    cacheInstagramThumbnail: cacheInstagramMock,
    cacheTikTokThumbnail: cacheTikTokMock,
    isS3Configured: isS3ConfiguredMock,
  };
});

import { betaLinkQueries } from '../graphql/resolvers/beta-videos/queries';

type Row = {
  boardType: string;
  climbUuid: string;
  link: string;
  foreignUsername: string | null;
  angle: number | null;
  thumbnail: string | null;
  isListed: boolean | null;
  createdAt: string | null;
};

function row(overrides: Partial<Row>): Row {
  return {
    boardType: 'kilter',
    climbUuid: 'climb-1',
    link: 'https://www.instagram.com/p/ABC/',
    foreignUsername: null,
    angle: null,
    thumbnail: null,
    isListed: true,
    createdAt: '2026-04-26T00:00:00Z',
    ...overrides,
  };
}

const OUR_S3_THUMB = 'https://bucket.example.com/beta-link-thumbnails/instagram/ABC.jpg';

describe('betaLinks resolver', () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    fetchInstagramMetaMock.mockReset();
    fetchTikTokMetaMock.mockReset();
    cacheInstagramMock.mockReset();
    cacheTikTokMock.mockReset();
    isS3ConfiguredMock.mockReset();
    isS3ConfiguredMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops KayaClimb rows entirely without enriching', async () => {
    selectMock.mockReturnValueOnce([
      row({ link: 'https://app.kayaclimb.com/share/post?id=1' }),
      row({ link: 'https://app.kayaclimb.com/share/post?id=2' }),
    ]);

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });

    expect(result).toEqual([]);
    expect(fetchInstagramMetaMock).not.toHaveBeenCalled();
    expect(fetchTikTokMetaMock).not.toHaveBeenCalled();
  });

  it('drops Instagram rows that come back as gone', async () => {
    selectMock.mockReturnValueOnce([row({ link: 'https://www.instagram.com/p/GONE/' })]);
    fetchInstagramMetaMock.mockResolvedValueOnce({ status: 'gone' });

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result).toEqual([]);
  });

  it('passes through rows on transient_error, only serving an S3-cached thumbnail', async () => {
    selectMock.mockReturnValueOnce([
      row({ link: 'https://www.instagram.com/p/ABC/', thumbnail: OUR_S3_THUMB, foreignUsername: 'climber' }),
    ]);
    fetchInstagramMetaMock.mockResolvedValueOnce({ status: 'transient_error' });

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ thumbnail: OUR_S3_THUMB, foreignUsername: 'climber' });
  });

  it('persists the S3 thumbnail on first read when S3 is configured', async () => {
    selectMock.mockReturnValueOnce([row({ link: 'https://www.instagram.com/p/ABC/', thumbnail: null })]);
    fetchInstagramMetaMock.mockResolvedValueOnce({
      status: 'ok',
      thumbnail: 'https://scontent.cdninstagram.com/raw.jpg',
      username: 'climber',
    });
    cacheInstagramMock.mockResolvedValueOnce(OUR_S3_THUMB);

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result[0]).toMatchObject({ thumbnail: OUR_S3_THUMB, foreignUsername: 'climber' });
    expect(cacheInstagramMock).toHaveBeenCalledWith('ABC', 'https://scontent.cdninstagram.com/raw.jpg');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('returns the dev proxy URL when S3 is not configured', async () => {
    isS3ConfiguredMock.mockReturnValue(false);
    selectMock.mockReturnValueOnce([row({ link: 'https://www.instagram.com/p/ABC/' })]);
    fetchInstagramMetaMock.mockResolvedValueOnce({
      status: 'ok',
      thumbnail: 'https://scontent.cdninstagram.com/raw.jpg',
      username: 'climber',
    });

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result[0]?.thumbnail).toBe(
      `/api/internal/instagram-thumbnail?url=${encodeURIComponent('https://scontent.cdninstagram.com/raw.jpg')}`,
    );
    expect(cacheInstagramMock).not.toHaveBeenCalled();
  });

  it('short-circuits the live fetch when row is fully enriched', async () => {
    selectMock.mockReturnValueOnce([
      row({
        link: 'https://www.instagram.com/p/ABC/',
        thumbnail: OUR_S3_THUMB,
        foreignUsername: 'climber',
      }),
    ]);

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result[0]).toMatchObject({ thumbnail: OUR_S3_THUMB, foreignUsername: 'climber' });
    expect(fetchInstagramMetaMock).not.toHaveBeenCalled();
  });

  it('routes TikTok URLs through the TikTok enricher', async () => {
    const tikUrl = 'https://www.tiktok.com/@climber/video/9999999999';
    selectMock.mockReturnValueOnce([row({ link: tikUrl })]);
    fetchTikTokMetaMock.mockResolvedValueOnce({
      status: 'ok',
      thumbnail: 'https://p16-common-sign.tiktokcdn.com/x.jpg?x-expires=1',
      username: 'climber',
    });
    cacheTikTokMock.mockResolvedValueOnce('https://bucket.example.com/beta-link-thumbnails/tiktok/9999999999.jpg');

    const result = await betaLinkQueries.betaLinks(undefined, { boardType: 'kilter', climbUuid: 'climb-1' });
    expect(result[0]).toMatchObject({
      link: tikUrl,
      foreignUsername: 'climber',
      thumbnail: 'https://bucket.example.com/beta-link-thumbnails/tiktok/9999999999.jpg',
    });
    expect(cacheTikTokMock).toHaveBeenCalledWith(
      '9999999999',
      'https://p16-common-sign.tiktokcdn.com/x.jpg?x-expires=1',
    );
    expect(fetchInstagramMetaMock).not.toHaveBeenCalled();
  });
});

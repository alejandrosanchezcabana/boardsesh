import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/app/lib/board-slug-utils', () => ({
  resolveBoardBySlug: vi.fn(async () => ({
    slug: 'my-board',
    boardType: 'kilter',
    layoutId: 1,
    sizeId: 7,
    setIds: '1,20',
  })),
  boardToRouteParams: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 7,
    set_ids: [1, 20],
    angle: 40,
  })),
}));

vi.mock('@/app/lib/board-utils', () => ({
  getBoardDetailsForBoard: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 7,
    set_ids: [1, 20],
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 144,
    edge_bottom: 0,
    edge_top: 180,
    boardWidth: 1080,
    boardHeight: 1350,
  })),
}));

vi.mock('@/app/lib/data/queries', () => ({
  getClimb: vi.fn(async () => ({
    name: 'Test Climb',
    difficulty: 'V5',
    setter_username: 'setter',
    quality_average: 4,
    ascensionist_count: 12,
    frames: 'p1r12,p2r13',
  })),
}));

vi.mock('@/app/lib/data/climb-detail-data.server', () => ({
  fetchClimbDetailData: vi.fn(async () => ({
    communityGrade: null,
    betaLinks: [],
  })),
}));

vi.mock('@/app/lib/warm-overlay-cache', () => ({
  scheduleOverlayWarming: vi.fn(),
}));

vi.mock('@/app/lib/url-utils', () => ({
  extractUuidFromSlug: vi.fn((value: string) => value),
}));

vi.mock('@/app/components/climb-detail/climb-detail-page.server', () => ({
  default: () => null,
}));

vi.mock('@/app/components/board-renderer/util', () => ({
  buildOgBoardRenderUrl: vi.fn(() => '/api/internal/board-render?board_name=kilter&variant=og&format=png'),
}));

const pageModule = await import('../page');

function getOpenGraphImageUrl(
  image: string | URL | { url: string | URL } | undefined,
) {
  if (!image) {
    return undefined;
  }

  if (typeof image === 'string') {
    return image;
  }

  if (image instanceof URL) {
    return image.toString();
  }

  return typeof image.url === 'string' ? image.url : image.url.toString();
}

describe('board slug climb metadata', () => {
  it('uses the immutable Rust board render URL for social images', async () => {
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({
        board_slug: 'my-board',
        angle: '40',
        climb_uuid: 'test-climb',
      }),
    });

    const image = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph.images[0]
      : metadata.openGraph?.images;
    const imageUrl = getOpenGraphImageUrl(image);

    expect(imageUrl).toBe('/api/internal/board-render?board_name=kilter&variant=og&format=png');
    expect(imageUrl).not.toContain('/api/og/climb');
  });
});

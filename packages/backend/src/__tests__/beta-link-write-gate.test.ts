import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(() => {
    throw new Error('db.select should not be called for non-Instagram URLs');
  }),
}));

vi.mock('../db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../events', () => ({
  publishSocialEvent: vi.fn(),
}));

vi.mock('../jobs/inferred-session-builder', () => ({
  assignInferredSession: vi.fn(),
}));

vi.mock('../graphql/resolvers/sessions/debounced-stats-publisher', () => ({
  publishDebouncedSessionStats: vi.fn(),
}));

vi.mock('../lib/beta-link-thumbnails', () => ({
  cacheInstagramThumbnail: vi.fn(),
  isS3Configured: vi.fn(() => false),
}));

import { validateAndEnrichBetaLinkInsert } from '../graphql/resolvers/ticks/mutations';

const fetchMock = vi.fn(() => {
  throw new Error('fetch should not be called for non-Instagram URLs');
});

describe('validateAndEnrichBetaLinkInsert (gate)', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    mockDbSelect.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips Instagram validation for TikTok URLs', async () => {
    const result = await validateAndEnrichBetaLinkInsert(
      'kilter',
      '00000000-0000-0000-0000-000000000000',
      'https://www.tiktok.com/@user/video/12345',
    );

    expect(result).toEqual({ thumbnail: null, foreignUsername: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('skips Instagram validation for short-form TikTok URLs', async () => {
    const result = await validateAndEnrichBetaLinkInsert(
      'tension',
      '00000000-0000-0000-0000-000000000000',
      'https://vm.tiktok.com/abc123',
    );

    expect(result).toEqual({ thumbnail: null, foreignUsername: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

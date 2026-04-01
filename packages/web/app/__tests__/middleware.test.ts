import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/lib/board-data', () => ({
  SUPPORTED_BOARDS: ['kilter', 'tension'],
}));

const { getListPageCacheControl } = await import('@/app/lib/list-page-cache');

function sp(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

describe('getListPageCacheControl', () => {
  it('returns public cache header for default list page', () => {
    expect(getListPageCacheControl('/kilter/original/12x12-square/screw_bolt/40/list', sp())).toBe(
      'public, s-maxage=86400, stale-while-revalidate=604800',
    );
  });

  it('returns public cache header with non-user-specific filters', () => {
    expect(
      getListPageCacheControl(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ minGrade: '10', sortBy: 'difficulty' }),
      ),
    ).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
  });

  it('returns private when hideAttempted=true', () => {
    expect(
      getListPageCacheControl(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'true' }),
      ),
    ).toBe('private, no-store');
  });

  it('returns private when onlyDrafts=1', () => {
    expect(
      getListPageCacheControl(
        '/tension/original/12x12-square/screw_bolt/40/list',
        sp({ onlyDrafts: '1' }),
      ),
    ).toBe('private, no-store');
  });

  it('treats hideAttempted=false as cacheable', () => {
    expect(
      getListPageCacheControl(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'false' }),
      ),
    ).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
  });

  it('treats hideAttempted=0 as cacheable', () => {
    expect(
      getListPageCacheControl(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: '0' }),
      ),
    ).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
  });

  it('treats hideAttempted=undefined (string) as cacheable', () => {
    expect(
      getListPageCacheControl(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'undefined' }),
      ),
    ).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
  });

  it('returns null for non-list pages', () => {
    expect(
      getListPageCacheControl('/kilter/original/12x12-square/screw_bolt/40/climb/abc', sp()),
    ).toBeNull();
  });

  it('returns null for unsupported board', () => {
    expect(
      getListPageCacheControl('/fakeboard/original/12x12-square/screw_bolt/40/list', sp()),
    ).toBeNull();
  });

  it('returns null for paths with too few segments', () => {
    expect(getListPageCacheControl('/kilter/list', sp())).toBeNull();
  });
});

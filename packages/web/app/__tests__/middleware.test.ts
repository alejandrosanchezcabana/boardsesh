import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/lib/board-data', () => ({
  SUPPORTED_BOARDS: ['kilter', 'tension'],
}));

const { getListPageCacheTTL } = await import('@/app/lib/list-page-cache');

function sp(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

const TTL_24H = 86400;

describe('getListPageCacheTTL', () => {
  // Legacy format: /[board]/[layout]/[size]/[sets]/[angle]/list
  it('returns TTL for default list page (legacy format)', () => {
    expect(getListPageCacheTTL('/kilter/original/12x12-square/screw_bolt/40/list', sp())).toBe(TTL_24H);
  });

  it('returns TTL with non-user-specific filters', () => {
    expect(
      getListPageCacheTTL(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ minGrade: '10', sortBy: 'difficulty' }),
      ),
    ).toBe(TTL_24H);
  });

  it('returns null when hideAttempted=true', () => {
    expect(
      getListPageCacheTTL(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'true' }),
      ),
    ).toBeNull();
  });

  it('returns null when onlyDrafts=1', () => {
    expect(
      getListPageCacheTTL(
        '/tension/original/12x12-square/screw_bolt/40/list',
        sp({ onlyDrafts: '1' }),
      ),
    ).toBeNull();
  });

  it('treats hideAttempted=false as cacheable', () => {
    expect(
      getListPageCacheTTL(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'false' }),
      ),
    ).toBe(TTL_24H);
  });

  it('treats hideAttempted=0 as cacheable', () => {
    expect(
      getListPageCacheTTL(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: '0' }),
      ),
    ).toBe(TTL_24H);
  });

  it('treats hideAttempted=undefined (string) as cacheable', () => {
    expect(
      getListPageCacheTTL(
        '/kilter/original/12x12-square/screw_bolt/40/list',
        sp({ hideAttempted: 'undefined' }),
      ),
    ).toBe(TTL_24H);
  });

  it('returns null for non-list pages', () => {
    expect(
      getListPageCacheTTL('/kilter/original/12x12-square/screw_bolt/40/climb/abc', sp()),
    ).toBeNull();
  });

  it('returns null for unsupported board (legacy format)', () => {
    expect(
      getListPageCacheTTL('/fakeboard/original/12x12-square/screw_bolt/40/list', sp()),
    ).toBeNull();
  });

  it('returns null for paths with too few segments', () => {
    expect(getListPageCacheTTL('/kilter/list', sp())).toBeNull();
  });

  // Slug format: /b/[board_slug]/[angle]/list
  it('returns TTL for slug format list page', () => {
    expect(getListPageCacheTTL('/b/kilter-original-12x12/40/list', sp())).toBe(TTL_24H);
  });

  it('returns null for slug format with user-specific params', () => {
    expect(
      getListPageCacheTTL('/b/kilter-original-12x12/40/list', sp({ hideCompleted: 'true' })),
    ).toBeNull();
  });

  it('returns null for /b/ paths with too few segments', () => {
    expect(getListPageCacheTTL('/b/list', sp())).toBeNull();
  });
});

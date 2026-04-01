import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/lib/board-data', () => ({
  SUPPORTED_BOARDS: ['kilter', 'tension'],
}));

const { getListPageCacheTTL } = await import('@/app/lib/list-page-cache');

function sp(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

const TTL_24H = 86400;
const LEGACY_LIST = '/kilter/original/12x12-square/screw_bolt/40/list';
const SLUG_LIST = '/b/kilter-original-12x12/40/list';

describe('getListPageCacheTTL', () => {
  // Legacy format: /[board]/[layout]/[size]/[sets]/[angle]/list
  it('returns TTL for default list page (legacy format)', () => {
    expect(getListPageCacheTTL(LEGACY_LIST, sp(), false)).toBe(TTL_24H);
  });

  it('returns TTL with non-user-specific filters', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ minGrade: '10', sortBy: 'difficulty' }), false),
    ).toBe(TTL_24H);
  });

  // User-specific params + authenticated session → skip cache
  it('returns null when authenticated user has hideAttempted=true', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ hideAttempted: 'true' }), true),
    ).toBeNull();
  });

  it('returns null when authenticated user has onlyDrafts=1', () => {
    expect(
      getListPageCacheTTL('/tension/original/12x12-square/screw_bolt/40/list', sp({ onlyDrafts: '1' }), true),
    ).toBeNull();
  });

  // User-specific params + anonymous → still cacheable (params have no effect without userId)
  it('returns TTL when anonymous user has hideAttempted=true', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ hideAttempted: 'true' }), false),
    ).toBe(TTL_24H);
  });

  it('returns TTL when anonymous user has onlyDrafts=1', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ onlyDrafts: '1' }), false),
    ).toBe(TTL_24H);
  });

  // Authenticated user without user-specific params → cacheable
  it('returns TTL for authenticated user without user-specific params', () => {
    expect(getListPageCacheTTL(LEGACY_LIST, sp(), true)).toBe(TTL_24H);
  });

  it('treats hideAttempted=false as cacheable even with session', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ hideAttempted: 'false' }), true),
    ).toBe(TTL_24H);
  });

  it('treats hideAttempted=0 as cacheable even with session', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ hideAttempted: '0' }), true),
    ).toBe(TTL_24H);
  });

  it('treats hideAttempted=undefined (string) as cacheable', () => {
    expect(
      getListPageCacheTTL(LEGACY_LIST, sp({ hideAttempted: 'undefined' }), false),
    ).toBe(TTL_24H);
  });

  // Non-list pages
  it('returns null for non-list pages', () => {
    expect(
      getListPageCacheTTL('/kilter/original/12x12-square/screw_bolt/40/climb/abc', sp(), false),
    ).toBeNull();
  });

  it('returns null for unsupported board (legacy format)', () => {
    expect(
      getListPageCacheTTL('/fakeboard/original/12x12-square/screw_bolt/40/list', sp(), false),
    ).toBeNull();
  });

  it('returns null for paths with too few segments', () => {
    expect(getListPageCacheTTL('/kilter/list', sp(), false)).toBeNull();
  });

  // Slug format: /b/[board_slug]/[angle]/list
  it('returns TTL for slug format list page', () => {
    expect(getListPageCacheTTL(SLUG_LIST, sp(), false)).toBe(TTL_24H);
  });

  it('returns null for slug format with user-specific params and session', () => {
    expect(
      getListPageCacheTTL(SLUG_LIST, sp({ hideCompleted: 'true' }), true),
    ).toBeNull();
  });

  it('returns TTL for slug format with user-specific params but no session', () => {
    expect(
      getListPageCacheTTL(SLUG_LIST, sp({ hideCompleted: 'true' }), false),
    ).toBe(TTL_24H);
  });

  it('returns null for /b/ paths with too few segments', () => {
    expect(getListPageCacheTTL('/b/list', sp(), false)).toBeNull();
  });
});

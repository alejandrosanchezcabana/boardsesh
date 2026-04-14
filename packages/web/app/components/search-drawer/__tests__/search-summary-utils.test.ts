import { describe, it, expect } from 'vitest';
import { hasActiveNonNameFilters, hasActiveFilters } from '../search-summary-utils';
import { DEFAULT_SEARCH_PARAMS } from '@/app/lib/url-utils';
import type { SearchRequestPagination } from '@/app/lib/types';

function makeParams(overrides: Partial<SearchRequestPagination> = {}): SearchRequestPagination {
  return { ...DEFAULT_SEARCH_PARAMS, ...overrides } as SearchRequestPagination;
}

describe('hasActiveNonNameFilters', () => {
  it('returns false when all params match defaults', () => {
    expect(hasActiveNonNameFilters(makeParams())).toBe(false);
  });

  it('returns false when only the name filter is active', () => {
    expect(hasActiveNonNameFilters(makeParams({ name: 'Cool Boulder' }))).toBe(false);
  });

  it('returns true when minGrade is set', () => {
    expect(hasActiveNonNameFilters(makeParams({ minGrade: 16 }))).toBe(true);
  });

  it('returns true when maxGrade is set', () => {
    expect(hasActiveNonNameFilters(makeParams({ maxGrade: 24 }))).toBe(true);
  });

  it('returns true when grade filters are active even with a name filter', () => {
    expect(
      hasActiveNonNameFilters(makeParams({ name: 'Test', minGrade: 10, maxGrade: 20 })),
    ).toBe(true);
  });

  it('returns true when holdsFilter has entries', () => {
    expect(
      hasActiveNonNameFilters(makeParams({ holdsFilter: { 1: { state: 'HAND' as const, color: '#ff0000', displayColor: '#ff0000' } } })),
    ).toBe(true);
  });

  it('returns false when holdsFilter is empty object', () => {
    expect(hasActiveNonNameFilters(makeParams({ holdsFilter: {} }))).toBe(false);
  });

  it('returns true when onlyClassics is true', () => {
    expect(hasActiveNonNameFilters(makeParams({ onlyClassics: true }))).toBe(true);
  });

  it('returns true when minAscents differs from default', () => {
    expect(hasActiveNonNameFilters(makeParams({ minAscents: 5 }))).toBe(true);
  });

  it('returns true when minRating differs from default', () => {
    expect(hasActiveNonNameFilters(makeParams({ minRating: 3 }))).toBe(true);
  });

  it('returns true when hideAttempted is true', () => {
    expect(hasActiveNonNameFilters(makeParams({ hideAttempted: true }))).toBe(true);
  });

  it('returns true when sortBy differs from default', () => {
    expect(hasActiveNonNameFilters(makeParams({ sortBy: 'quality' }))).toBe(true);
  });
});

describe('hasActiveFilters', () => {
  it('returns false when all params match defaults', () => {
    expect(hasActiveFilters(makeParams())).toBe(false);
  });

  it('returns true when name is set (unlike hasActiveNonNameFilters)', () => {
    expect(hasActiveFilters(makeParams({ name: 'Cool Boulder' }))).toBe(true);
  });

  it('returns true when grade filters are active', () => {
    expect(hasActiveFilters(makeParams({ minGrade: 10 }))).toBe(true);
  });

  it('returns true when holdsFilter has entries', () => {
    expect(hasActiveFilters(makeParams({ holdsFilter: { 1: { state: 'HAND' as const, color: '#ff0000', displayColor: '#ff0000' } } }))).toBe(true);
  });
});

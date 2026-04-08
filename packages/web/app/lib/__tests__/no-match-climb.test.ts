import { describe, it, expect } from 'vitest';
import { isNoMatchClimb } from '../no-match-climb';

describe('isNoMatchClimb', () => {
  it('returns false for null/undefined/empty description', () => {
    expect(isNoMatchClimb(null)).toBe(false);
    expect(isNoMatchClimb(undefined)).toBe(false);
    expect(isNoMatchClimb('')).toBe(false);
  });

  it('detects common "no match" variations (case-insensitive)', () => {
    expect(isNoMatchClimb('No matching')).toBe(true);
    expect(isNoMatchClimb('No match')).toBe(true);
    expect(isNoMatchClimb('no matching')).toBe(true);
    expect(isNoMatchClimb('NO MATCHING')).toBe(true);
    expect(isNoMatchClimb('No Matching')).toBe(true);
    expect(isNoMatchClimb('No matches')).toBe(true);
    expect(isNoMatchClimb('No matchy')).toBe(true);
    expect(isNoMatchClimb('No matchies')).toBe(true);
    expect(isNoMatchClimb('No matching!')).toBe(true);
    expect(isNoMatchClimb('No matching.')).toBe(true);
    expect(isNoMatchClimb('No matching :)')).toBe(true);
    expect(isNoMatchClimb('No matching. Some extra notes')).toBe(true);
  });

  it('returns false for unrelated descriptions', () => {
    expect(isNoMatchClimb('A fun climb')).toBe(false);
    expect(isNoMatchClimb('V3')).toBe(false);
    expect(isNoMatchClimb('Campus')).toBe(false);
    expect(isNoMatchClimb('Matching allowed')).toBe(false);
    expect(isNoMatchClimb('Match only the finish hold')).toBe(false);
  });
});

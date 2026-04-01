import { describe, it, expect } from 'vitest';
import { formatAscents, formatQuality } from '@/app/lib/format-climb-stats';

describe('formatAscents', () => {
  it('returns raw number below 1000', () => {
    expect(formatAscents(0)).toBe('0');
    expect(formatAscents(1)).toBe('1');
    expect(formatAscents(378)).toBe('378');
    expect(formatAscents(999)).toBe('999');
  });

  it('formats 1000–9999 with 1 decimal + k', () => {
    expect(formatAscents(1000)).toBe('1k');
    expect(formatAscents(1900)).toBe('1.9k');
    expect(formatAscents(2500)).toBe('2.5k');
    expect(formatAscents(9499)).toBe('9.5k');
  });

  it('handles the boundary without showing 10.0k', () => {
    expect(formatAscents(9950)).toBe('9.9k');
    expect(formatAscents(9960)).toBe('10k');
    expect(formatAscents(9999)).toBe('10k');
  });

  it('formats ≥10000 as rounded integer + k', () => {
    expect(formatAscents(10000)).toBe('10k');
    expect(formatAscents(13200)).toBe('13k');
    expect(formatAscents(13800)).toBe('14k');
    expect(formatAscents(100000)).toBe('100k');
  });
});

describe('formatQuality', () => {
  it('rounds to 1 decimal place', () => {
    expect(formatQuality('2.666')).toBe('2.7');
    expect(formatQuality('3.0')).toBe('3.0');
    expect(formatQuality('4.56')).toBe('4.6');
    expect(formatQuality('1')).toBe('1.0');
  });

  it('returns original string for non-numeric input', () => {
    expect(formatQuality('abc')).toBe('abc');
    expect(formatQuality('')).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { formatCount, formatAscents, formatQuality } from '@/app/lib/format-climb-stats';

describe('formatCount', () => {
  it('returns raw number below 1000', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1)).toBe('1');
    expect(formatCount(378)).toBe('378');
    expect(formatCount(999)).toBe('999');
  });

  it('formats 1000–9999 with 1 decimal + k', () => {
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(1900)).toBe('1.9k');
    expect(formatCount(2500)).toBe('2.5k');
    expect(formatCount(9499)).toBe('9.5k');
  });

  it('handles the boundary without showing 10.0k', () => {
    expect(formatCount(9950)).toBe('9.9k');
    expect(formatCount(9960)).toBe('10k');
    expect(formatCount(9999)).toBe('10k');
  });

  it('formats ≥10000 as rounded integer + k', () => {
    expect(formatCount(10000)).toBe('10k');
    expect(formatCount(13200)).toBe('13k');
    expect(formatCount(13800)).toBe('14k');
    expect(formatCount(100000)).toBe('100k');
    expect(formatCount(999499)).toBe('999k');
  });

  it('formats ≥1000000 with 1 decimal + m', () => {
    expect(formatCount(1000000)).toBe('1m');
    expect(formatCount(1400000)).toBe('1.4m');
    expect(formatCount(2500000)).toBe('2.5m');
    expect(formatCount(10000000)).toBe('10m');
    expect(formatCount(15300000)).toBe('15.3m');
  });
});

describe('formatAscents', () => {
  it('uses singular for count of 1', () => {
    expect(formatAscents(1)).toBe('1 ascent');
  });

  it('uses plural for counts other than 1', () => {
    expect(formatAscents(0)).toBe('0 ascents');
    expect(formatAscents(2)).toBe('2 ascents');
    expect(formatAscents(999)).toBe('999 ascents');
  });

  it('uses plural with compact notation', () => {
    expect(formatAscents(1000)).toBe('1k ascents');
    expect(formatAscents(1500000)).toBe('1.5m ascents');
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

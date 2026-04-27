import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import {
  formatTickAbsoluteTime,
  formatTickRelativeTime,
  parseTickTime,
  tickTimeMs,
} from '@/app/lib/format-tick-time';

const NAIVE = '2026-04-27 05:39:13.000';
const Z_FORM = '2026-04-27T05:39:13.000Z';
const ABSOLUTE_MS = Date.UTC(2026, 3, 27, 5, 39, 13, 0);

describe('formatTickRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T05:40:13.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats Drizzle naive timestamp strings as UTC absolute moments', () => {
    expect(formatTickRelativeTime(NAIVE)).toBe('a minute ago');
  });

  it('agrees with the equivalent Z-suffixed ISO string', () => {
    // If the helper ever drops `dayjs.utc(...)`, this fails on any non-UTC host
    // because dayjs parses the naive form in local time but the Z form in UTC.
    expect(formatTickRelativeTime(NAIVE)).toBe(formatTickRelativeTime(Z_FORM));
  });
});

describe('tickTimeMs', () => {
  it('returns the same epoch ms for naive and Z-suffixed strings', () => {
    expect(tickTimeMs(NAIVE)).toBe(ABSOLUTE_MS);
    expect(tickTimeMs(NAIVE)).toBe(tickTimeMs(Z_FORM));
  });

  it('orders ticks by absolute moment', () => {
    const earlier = '2026-04-27 05:00:00.000';
    const later = '2026-04-27 06:00:00.000';
    expect(tickTimeMs(later) - tickTimeMs(earlier)).toBe(60 * 60 * 1000);
  });
});

describe('parseTickTime', () => {
  it('lands on the same epoch ms as a Z-suffixed parse', () => {
    expect(parseTickTime(NAIVE).valueOf()).toBe(ABSOLUTE_MS);
  });
});

describe('formatTickAbsoluteTime', () => {
  it('parses naive strings as UTC, not local time', () => {
    // The output is the local-clock equivalent of the UTC moment; rendering
    // it with a `Z` offset token and parsing back via `Date` recovers the
    // absolute ms regardless of host TZ. If the helper ever parsed NAIVE in
    // local time, the recovered ms would be off by the host offset.
    const formatted = formatTickAbsoluteTime(NAIVE, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
    expect(new Date(formatted).getTime()).toBe(ABSOLUTE_MS);
  });
});

describe('helper guards', () => {
  it('throws when given an empty string instead of silently using "now"', () => {
    expect(() => formatTickRelativeTime('')).toThrow(TypeError);
    expect(() => parseTickTime('')).toThrow(TypeError);
    expect(() => tickTimeMs('')).toThrow(TypeError);
    expect(() => formatTickAbsoluteTime('', 'X')).toThrow(TypeError);
  });
});

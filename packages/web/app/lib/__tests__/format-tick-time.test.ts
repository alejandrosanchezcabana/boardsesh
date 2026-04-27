import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { formatTickRelativeTime } from '@/app/lib/format-tick-time';

describe('formatTickRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 60 seconds after the seeded climbed_at strings below, in UTC absolute terms.
    vi.setSystemTime(new Date('2026-04-27T05:40:13.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats Drizzle naive timestamp strings as UTC absolute moments', () => {
    // The shape Drizzle returns from boardsesh_ticks.climbed_at — no Z, no offset.
    expect(formatTickRelativeTime('2026-04-27 05:39:13.000')).toBe('a minute ago');
  });

  it('agrees with the equivalent Z-suffixed ISO string', () => {
    expect(formatTickRelativeTime('2026-04-27 05:39:13.000')).toBe(
      formatTickRelativeTime('2026-04-27T05:39:13.000Z'),
    );
  });

  it('produces the same output regardless of how the host parses the naive string', () => {
    // The naive form parsed via dayjs.utc must land on the same absolute moment as
    // the explicit UTC ISO form. If the helper ever drops `dayjs.utc(...)`, this
    // assertion fails on any non-UTC host because dayjs would parse the naive
    // string in local time instead.
    const naive = '2026-04-27 05:39:13.000';
    const explicit = '2026-04-27T05:39:13.000Z';
    expect(formatTickRelativeTime(naive)).toBe(formatTickRelativeTime(explicit));
  });
});

import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(isoWeek);
dayjs.extend(relativeTime);
dayjs.extend(utc);

// `boardsesh_ticks.climbed_at` (and `created_at` / `updated_at`) are naive
// `timestamp` columns. Drizzle returns them as strings with no `Z` suffix,
// so any `dayjs(<naiveString>)` call would parse them as browser-local time.
// These helpers parse through `dayjs.utc(...)` to recover the absolute moment
// before any rendering, sorting, or bucketing.

export function parseTickTime(climbedAt: string): Dayjs {
  return dayjs.utc(climbedAt).local();
}

export function formatTickRelativeTime(climbedAt: string): string {
  return dayjs.utc(climbedAt).fromNow();
}

export function formatTickAbsoluteTime(climbedAt: string, format: string): string {
  return parseTickTime(climbedAt).format(format);
}

export function tickTimeMs(climbedAt: string): number {
  return dayjs.utc(climbedAt).valueOf();
}

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);

// `boardsesh_ticks.climbed_at` is a naive `timestamp` column, so Drizzle
// returns it as a string with no `Z` suffix. Parse it through `dayjs.utc`
// to recover the absolute moment, otherwise non-UTC viewers see the time
// shifted by their local offset.
export function formatTickRelativeTime(climbedAt: string): string {
  return dayjs.utc(climbedAt).fromNow();
}

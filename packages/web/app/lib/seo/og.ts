export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const ONE_YEAR_SECONDS = 31_536_000;
const SHORT_TTL_SECONDS = 300;
const STALE_TTL_SECONDS = 86_400;

function toVersionMillis(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }

  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

export function buildOgVersionToken(
  ...values: Array<Date | string | number | null | undefined>
): string {
  let maxMillis = 0;

  for (const value of values) {
    const millis = toVersionMillis(value);
    if (millis !== null && millis > maxMillis) {
      maxMillis = millis;
    }
  }

  return maxMillis.toString(36);
}

export function buildVersionedOgImagePath(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
  version?: string | null,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "boolean") {
      if (value) {
        searchParams.set(key, "1");
      }
      continue;
    }

    searchParams.set(key, String(value));
  }

  if (version) {
    searchParams.set("v", version);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function createOgImageHeaders({
  contentType,
  version,
  serverTiming,
}: {
  contentType: string;
  version?: string | null;
  serverTiming?: string;
}): HeadersInit {
  const isVersioned = version !== null && version !== undefined;
  const browserCacheControl = isVersioned
    ? `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`
    : `public, max-age=0, s-maxage=${SHORT_TTL_SECONDS}, stale-while-revalidate=${STALE_TTL_SECONDS}`;
  const cdnCacheControl = isVersioned
    ? `public, s-maxage=${ONE_YEAR_SECONDS}, immutable`
    : `public, s-maxage=${SHORT_TTL_SECONDS}, stale-while-revalidate=${STALE_TTL_SECONDS}`;

  return {
    "Content-Type": contentType,
    "Cache-Control": browserCacheControl,
    "CDN-Cache-Control": cdnCacheControl,
    "Vercel-CDN-Cache-Control": cdnCacheControl,
    ...(serverTiming ? { "Server-Timing": serverTiming } : {}),
  };
}

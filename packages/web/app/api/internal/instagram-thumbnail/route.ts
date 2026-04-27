import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST_SUFFIXES = [
  '.fbcdn.net',
  '.cdninstagram.com',
  '.tiktokcdn.com',
  '.tiktokcdn-us.com',
  '.tiktokcdn-eu.com',
];
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const dynamic = 'force-dynamic';

/**
 * Disable the proxy whenever real S3 storage is configured. The proxy only
 * exists for the dev path where thumbnails can't be cached to a public bucket;
 * any environment with `AWS_S3_BUCKET_NAME` set should serve persisted S3
 * URLs directly. Returning 410 closes off a needless SSRF surface in prod.
 */
function isProxyDisabled(): boolean {
  return !!process.env.AWS_S3_BUCKET_NAME;
}

export async function GET(request: NextRequest) {
  if (isProxyDisabled()) {
    return new NextResponse('Disabled', { status: 410 });
  }
  const target = request.nextUrl.searchParams.get('url');
  if (!target) return new NextResponse('Missing url', { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (parsed.protocol !== 'https:') return new NextResponse('Invalid protocol', { status: 400 });
  const hostAllowed = ALLOWED_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix));
  if (!hostAllowed) return new NextResponse('Host not allowed', { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!upstream.ok || !upstream.body) {
      return new NextResponse('Upstream failed', { status: upstream.status || 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}

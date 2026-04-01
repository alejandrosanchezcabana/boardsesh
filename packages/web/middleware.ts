// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SUPPORTED_BOARDS } from './app/lib/board-data';
import { getListPageCacheTTL } from './app/lib/list-page-cache';
import { precomputeAllFlags } from './app/flags';
import { CLIMB_SESSION_COOKIE } from './app/lib/climb-session-cookie';

const SPECIAL_ROUTES = ['angles', 'grades']; // routes that don't need board validation

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block PHP requests
  if (pathname.includes('.php')) {
    return new NextResponse(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  // Check API routes
  if (pathname.startsWith('/api/v1/')) {
    const pathParts = pathname.split('/');
    if (pathParts.length >= 4) {
      const routeIdentifier = pathParts[3].toLowerCase(); // either a board name or special route

      // Allow special routes to pass through
      if (SPECIAL_ROUTES.includes(routeIdentifier)) {
        return NextResponse.next();
      }

      // For all other routes, validate board name
      if (!(SUPPORTED_BOARDS as readonly string[]).includes(routeIdentifier)) {
        console.info('Middleware board_name check returned 404');
        return new NextResponse(null, {
          status: 404,
          statusText: 'Not Found',
        });
      }
    }
  }

  // Backward compat: redirect old ?session= URLs to clean URLs with cookie.
  // The redirect cost (~150ms) is far less than a CDN cache miss (1.3-1.6s).
  const sessionParam = request.nextUrl.searchParams.get('session');
  if (sessionParam) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('session');
    const response = NextResponse.redirect(cleanUrl, 307);
    response.cookies.set(CLIMB_SESSION_COOKIE, sessionParam, {
      path: '/',
      sameSite: 'lax',
      maxAge: 86400,
    });
    return response;
  }

  // Generate visitor ID early so it's available for flag evaluation.
  // On first visit the cookie won't be on the request yet, so we generate
  // it here and inject it into the request cookies so precomputeAllFlags()
  // can read it immediately (no second-request delay).
  const hasVisitorId = request.cookies.has('bs_vid');
  let visitorId: string | undefined;
  if (!hasVisitorId) {
    visitorId = crypto.randomUUID();
    request.cookies.set('bs_vid', visitorId);
  }

  let response: NextResponse | undefined;

  // Use Vercel-CDN-Cache-Control because Next.js overwrites Cache-Control
  // for dynamic pages (pages that use searchParams) with "private, no-store".
  // Vercel-CDN-Cache-Control is the highest-priority header for Vercel's CDN
  // and is not touched by Next.js rendering.
  const cacheTTL = getListPageCacheTTL(pathname, request.nextUrl.searchParams);
  if (cacheTTL !== null) {
    // Flag overrides via Vercel Toolbar must bypass CDN cache so the
    // developer sees their overridden values immediately.
    if (request.cookies.has('vercel-flag-overrides')) {
      response = NextResponse.next();
    } else {
      try {
        // Evaluate flags at the edge and encode the combination into a signed
        // code. Rewrite the URL to include the code as a query param so the CDN
        // caches different responses per flag combination. When a flag changes,
        // the code changes → cache miss → fresh render with correct values.
        const code = await precomputeAllFlags();
        const url = request.nextUrl.clone();
        url.searchParams.set('_flags', code);
        response = NextResponse.rewrite(url);
      } catch {
        // Flag evaluation failed — fall through without variant rewrite.
        // The page still renders correctly (layout.tsx evaluates flags
        // independently), we just lose CDN cache differentiation by flags.
        response = NextResponse.next();
      }

      const cdnCacheValue = `s-maxage=${cacheTTL}, stale-while-revalidate=${cacheTTL * 7}`;
      response.headers.set('Vercel-CDN-Cache-Control', cdnCacheValue);
      response.headers.set('CDN-Cache-Control', cdnCacheValue);
    }
  }

  if (!response) {
    response = NextResponse.next();
  }

  // Persist the visitor ID cookie so subsequent requests carry it.
  if (visitorId) {
    response.cookies.set('bs_vid', visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/v1/:path*',
    // Match all page routes but skip static files, Next.js internals, and Vercel Flags Explorer
    '/((?!_next/static|_next/image|favicon.ico|monitoring|\\.well-known/vercel/flags|.*\\..*).*)',
  ],
};

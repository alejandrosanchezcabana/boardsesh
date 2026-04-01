// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SUPPORTED_BOARDS } from './app/lib/board-data';
import { getListPageCacheTTL } from './app/lib/list-page-cache';

const SPECIAL_ROUTES = ['angles', 'grades']; // routes that don't need board validation

export function middleware(request: NextRequest) {
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

  // Use Vercel-CDN-Cache-Control because Next.js overwrites Cache-Control
  // for dynamic pages (pages that use searchParams) with "private, no-store".
  // Vercel-CDN-Cache-Control is the highest-priority header for Vercel's CDN
  // and is not touched by Next.js rendering.
  const hasSession = request.cookies.has('__Secure-next-auth.session-token') ||
    request.cookies.has('next-auth.session-token');
  const cacheTTL = getListPageCacheTTL(pathname, request.nextUrl.searchParams, hasSession);
  if (cacheTTL !== null) {
    const cdnCacheValue = `s-maxage=${cacheTTL}, stale-while-revalidate=${cacheTTL * 7}`;
    const response = NextResponse.next();
    response.headers.set('Vercel-CDN-Cache-Control', cdnCacheValue);
    response.headers.set('CDN-Cache-Control', cdnCacheValue);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/v1/:path*',
    // Match all page routes but skip static files, Next.js internals, and Vercel Flags Explorer
    '/((?!_next/static|_next/image|favicon.ico|monitoring|\\.well-known/vercel/flags|.*\\..*).*)',
  ],
};

import { SUPPORTED_BOARDS } from '@boardsesh/shared-schema';

const BOARD_NAMES = new Set(SUPPORTED_BOARDS);

function getPathSegments(pathname: string): string[] {
  return pathname.split('?')[0].split('/').filter(Boolean);
}

export function isBoardRoutePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/b/')) return true;

  const [firstSegment] = getPathSegments(pathname);
  return firstSegment !== undefined && BOARD_NAMES.has(firstSegment as typeof SUPPORTED_BOARDS[number]);
}

export function isBoardListPath(pathname: string | null | undefined): boolean {
  if (!pathname || !isBoardRoutePath(pathname)) return false;
  return getPathSegments(pathname).includes('list');
}

/**
 * Derive effective authentication status for the library page.
 *
 * During SSR, `useSession()` starts in `'loading'` state. If the server already
 * fetched user data (playlists, boards), we treat the user as authenticated while
 * the session is loading to prevent SSR content from flashing away during hydration.
 *
 * Once `useSession()` settles (to `'authenticated'` or `'unauthenticated'`), we
 * defer to its verdict so session expiry or logout in another tab correctly
 * reverts the UI.
 */
export function deriveIsAuthenticated(
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated',
  hasServerUserData: boolean,
): boolean {
  return (
    sessionStatus === 'authenticated' || (sessionStatus === 'loading' && hasServerUserData)
  );
}

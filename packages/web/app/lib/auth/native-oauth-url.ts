const sanitizeRelativePath = (path: string): string => (path.startsWith('/') ? path : '/');

/**
 * Build the URL that opens in the external browser for native OAuth.
 *
 * Points to /auth/native-start, which fetches a CSRF token and auto-submits
 * a POST to /api/auth/signin/{provider}. A direct GET to the NextAuth sign-in
 * route would redirect to the custom login page (pages.signIn is set),
 * requiring a second tap — the POST bypasses that and goes straight to the
 * OAuth provider.
 */
export const buildNativeOAuthSignInUrl = ({
  origin,
  provider,
  callbackPath,
}: {
  origin: string;
  provider: string;
  callbackPath: string;
}): string => {
  const nextPath = sanitizeRelativePath(callbackPath);
  const nativeCallbackUrl = `${origin}/api/auth/native/callback?next=${encodeURIComponent(nextPath)}`;
  const startUrl = new URL('/auth/native-start', origin);
  startUrl.searchParams.set('provider', provider);
  startUrl.searchParams.set('callbackUrl', nativeCallbackUrl);
  return startUrl.toString();
};

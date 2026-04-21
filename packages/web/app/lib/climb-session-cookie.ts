/**
 * Utility for managing the party-mode climb session ID via a browser cookie.
 *
 * Named "climb session" (not just "session") to avoid confusion with auth
 * session cookies (next-auth.session-token).
 *
 * The session ID was previously stored as a `?session=` URL query parameter,
 * which prevented Vercel CDN from caching list pages effectively (each unique
 * session UUID produced a distinct cache key). Moving it to a cookie keeps the
 * URL clean so all users — with or without a session — share the same CDN entry.
 */

export const CLIMB_SESSION_COOKIE = "boardsesh-climb-session-id";

const ONE_DAY_SECONDS = 86400;

export function getClimbSessionCookie(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CLIMB_SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setClimbSessionCookie(sessionId: string): void {
  if (typeof document === "undefined") return;

  document.cookie = `${CLIMB_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; path=/; SameSite=Lax; max-age=${ONE_DAY_SECONDS}`;
}

export function clearClimbSessionCookie(): void {
  if (typeof document === "undefined") return;

  document.cookie = `${CLIMB_SESSION_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
}

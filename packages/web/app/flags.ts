import { flag, evaluate, combine, precompute } from 'flags/next';
import { vercelAdapter } from '@flags-sdk/vercel';
import { decode } from 'next-auth/jwt';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// Only use the Vercel adapter when the FLAGS env var is available (set automatically
// on Vercel). Locally, flags fall through to their decide() functions.
const adapter = process.env.FLAGS ? vercelAdapter() : undefined;

// Edge-compatible identify: reads visitor ID and decodes the NextAuth JWT
// directly from cookies. Works in both Edge middleware (precompute) and
// Node server components (evaluateAllFlags) because the Flags SDK passes
// { headers, cookies } to identify in both contexts.
async function identify({ cookies }: { cookies: ReadonlyRequestCookies }) {
  const visitorId = cookies.get('bs_vid')?.value;

  const sessionToken =
    cookies.get('__Secure-next-auth.session-token')?.value ??
    cookies.get('next-auth.session-token')?.value;

  let user: { id: string; email: string } | undefined;
  if (sessionToken) {
    try {
      const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
      if (!secret) return { ...(visitorId ? { visitorId } : {}) };
      const decoded = await decode({ token: sessionToken, secret });
      if (decoded?.sub && typeof decoded?.email === 'string') {
        user = { id: decoded.sub, email: decoded.email };
      }
    } catch {
      // Invalid or expired token — treat as anonymous
    }
  }

  return {
    ...(visitorId ? { visitorId } : {}),
    ...(user ? { user } : {}),
  };
}

export const rustSvgRendering = flag({
  key: 'rust-svg-rendering',
  defaultValue: false,
  description: 'Use Rust WASM renderer for board overlays instead of SVG',
  identify,
  options: [
    { value: true, label: 'Enabled' },
    { value: false, label: 'Disabled' },
  ],
  // When the adapter is available, let it be the sole decision maker.
  // When no adapter (local dev), use decide() which falls back to defaultValue.
  ...(adapter
    ? { adapter }
    : { decide: () => false as boolean }),
});

export const wasmRendering = flag({
  key: 'wasm-rendering',
  defaultValue: false,
  description: 'Use Web Worker + WASM renderer with OffscreenCanvas for board overlays',
  identify,
  options: [
    { value: true, label: 'Enabled' },
    { value: false, label: 'Disabled' },
  ],
  ...(adapter
    ? { adapter }
    : { decide: () => false as boolean }),
});

// Add new flags above this line, then add them to allFlags below.
export const allFlags = [rustSvgRendering, wasmRendering] as const;

type FlagTuple = typeof allFlags;
export type FeatureFlags = {
  [K in FlagTuple[number] as K['key']]: Awaited<ReturnType<K>>;
};

export async function evaluateAllFlags(): Promise<FeatureFlags> {
  const values = await evaluate(allFlags);
  return combine(allFlags, values) as FeatureFlags;
}

/**
 * Evaluate all flags and return a signed code string.
 * Call this in middleware, then pass the code via URL rewrite so the CDN
 * caches different responses per flag combination.
 */
export async function precomputeAllFlags(): Promise<string> {
  return precompute(allFlags);
}

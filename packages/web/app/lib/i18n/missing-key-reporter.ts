import * as Sentry from '@sentry/nextjs';

const reported = new Set<string>();

export function reportMissingI18nKey(args: {
  lngs: readonly string[];
  ns: string;
  key: string;
  fallbackValue?: unknown;
}) {
  // Sentry's `enabled` flag (instrumentation-client.ts / sentry.server.config.ts)
  // already gates the network call, but skip the work in non-production
  // environments so dev/preview/test runs don't pay the dedupe + payload cost
  // and so a future SDK misconfiguration can't accidentally ship missing-key
  // events from local builds.
  if (process.env.NODE_ENV !== 'production') return;

  const dedupeKey = `${args.lngs.join(',')}|${args.ns}|${args.key}`;
  if (reported.has(dedupeKey)) return;
  reported.add(dedupeKey);

  Sentry.captureMessage(`Missing i18n key: ${args.ns}:${args.key}`, {
    level: 'warning',
    tags: {
      i18n_namespace: args.ns,
      i18n_locale: args.lngs[0] ?? 'unknown',
    },
    extra: {
      i18n_key: args.key,
      i18n_locales: args.lngs,
      i18n_fallback: args.fallbackValue,
    },
  });
}

// Test-only hook: clears the per-process dedupe Set so unit tests can
// exercise the "first hit" path repeatedly without import-order coupling.
export function __resetMissingI18nKeyReporterForTests() {
  reported.clear();
}

import * as Sentry from '@sentry/nextjs';

const reported = new Set<string>();

export function reportMissingI18nKey(args: {
  lngs: readonly string[];
  ns: string;
  key: string;
  fallbackValue?: unknown;
}) {
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

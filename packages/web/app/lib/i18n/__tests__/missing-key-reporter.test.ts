import { describe, expect, it, vi, beforeEach, afterEach } from 'vite-plus/test';
import { reportMissingI18nKey, __resetMissingI18nKeyReporterForTests } from '../missing-key-reporter';

const captureMessage = vi.hoisted(() => vi.fn());

vi.mock('@sentry/nextjs', () => ({
  captureMessage,
}));

describe('reportMissingI18nKey', () => {
  beforeEach(() => {
    captureMessage.mockClear();
    __resetMissingI18nKeyReporterForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no-ops outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    reportMissingI18nKey({ lngs: ['en-US'], ns: 'auth', key: 'login.title' });

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('forwards to Sentry in production with namespace + locale tags', () => {
    vi.stubEnv('NODE_ENV', 'production');

    reportMissingI18nKey({
      lngs: ['es', 'en-US'],
      ns: 'auth',
      key: 'login.placeholders.email',
      fallbackValue: 'Email',
    });

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith('Missing i18n key: auth:login.placeholders.email', {
      level: 'warning',
      tags: { i18n_namespace: 'auth', i18n_locale: 'es' },
      extra: {
        i18n_key: 'login.placeholders.email',
        i18n_locales: ['es', 'en-US'],
        i18n_fallback: 'Email',
      },
    });
  });

  it('dedupes repeated reports of the same key', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const args = { lngs: ['en-US'], ns: 'auth', key: 'login.title' };
    reportMissingI18nKey(args);
    reportMissingI18nKey(args);
    reportMissingI18nKey(args);

    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it('reports distinct keys separately', () => {
    vi.stubEnv('NODE_ENV', 'production');

    reportMissingI18nKey({ lngs: ['en-US'], ns: 'auth', key: 'a' });
    reportMissingI18nKey({ lngs: ['en-US'], ns: 'auth', key: 'b' });
    reportMissingI18nKey({ lngs: ['es'], ns: 'auth', key: 'a' });

    expect(captureMessage).toHaveBeenCalledTimes(3);
  });

  it('falls back to "unknown" locale tag when lngs is empty', () => {
    vi.stubEnv('NODE_ENV', 'production');

    reportMissingI18nKey({ lngs: [], ns: 'common', key: 'foo' });

    expect(captureMessage).toHaveBeenCalledWith(
      'Missing i18n key: common:foo',
      expect.objectContaining({ tags: { i18n_namespace: 'common', i18n_locale: 'unknown' } }),
    );
  });
});

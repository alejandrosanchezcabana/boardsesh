import 'server-only';
import { createInstance, type i18n, type TFunction } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next/initReactI18next';
import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, SUPPORTED_LOCALES, type Locale, type SeedNamespace } from './config';
import { getLocale } from './get-locale';

const resourceLoader = resourcesToBackend(
  (locale: string, namespace: string) => import(`../../../i18n/locales/${locale}/${namespace}.json`),
);

async function initI18nInstance(locale: Locale, namespaces: readonly string[]): Promise<i18n> {
  const instance = createInstance();
  await instance
    .use(resourceLoader)
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      defaultNS: DEFAULT_NAMESPACE,
      ns: namespaces,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  return instance;
}

export async function getServerTranslation(
  ns: SeedNamespace | readonly SeedNamespace[] = DEFAULT_NAMESPACE,
): Promise<{ t: TFunction; i18n: i18n; locale: Locale }> {
  const locale = await getLocale();
  const namespaces = Array.isArray(ns) ? ns : [ns];
  const instance = await initI18nInstance(locale, namespaces);
  const primaryNs = namespaces[0];
  return { t: instance.getFixedT(locale, primaryNs), i18n: instance, locale };
}

export async function loadServerResources(
  locale: Locale,
  namespaces: readonly SeedNamespace[],
): Promise<Record<string, Record<string, unknown>>> {
  const instance = await initI18nInstance(locale, namespaces);
  const resources: Record<string, Record<string, unknown>> = {};
  for (const ns of namespaces) {
    resources[ns] = (instance.getResourceBundle(locale, ns) ?? {}) as Record<string, unknown>;
  }
  return resources;
}

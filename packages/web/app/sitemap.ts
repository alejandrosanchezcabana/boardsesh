import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/app/lib/seo/base-url';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/app/lib/i18n/config';
import { localeHref } from '@/app/lib/i18n/locale-href';

type StaticEntry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const STATIC_ENTRIES: StaticEntry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/aurora-migration', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/playlists', changeFrequency: 'weekly', priority: 0.6 },
];

function buildLanguageMap(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = absoluteUrl(localeHref(path, locale));
  }
  languages['x-default'] = absoluteUrl(localeHref(path, DEFAULT_LOCALE));
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const result: MetadataRoute.Sitemap = [];

  for (const entry of STATIC_ENTRIES) {
    const languages = buildLanguageMap(entry.path);
    for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
      result.push({
        url: absoluteUrl(localeHref(entry.path, locale)),
        lastModified,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: { languages },
      });
    }
  }

  return result;
}

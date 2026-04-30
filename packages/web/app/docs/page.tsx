import { createPageMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import DocsClientPage from './docs-client';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('marketing');
  return createPageMetadata({
    title: t('metadata.docs.title'),
    description: t('metadata.docs.description'),
    path: '/docs',
    locale,
  });
}

export default function DocsPage() {
  return <DocsClientPage />;
}

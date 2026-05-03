import React from 'react';
import Box from '@mui/material/Box';
import { redirect } from 'next/navigation';
import { getYouSession } from './you-auth';
import YouTabBar from './you-tab-bar';
import styles from '@/app/profile/[user_id]/profile-page.module.css';
import { getLocale } from '@/app/lib/i18n/get-locale';
import I18nProvider from '@/app/components/providers/i18n-provider';

export default async function YouLayout({ children }: { children: React.ReactNode }) {
  const session = await getYouSession();
  if (!session?.user?.id) {
    redirect('/');
  }

  const locale = await getLocale();

  return (
    <I18nProvider locale={locale} namespaces={['you', 'profile', 'climbs', 'boards', 'feed']}>
      <Box className={styles.layout}>
        <Box component="main" className={styles.content}>
          <YouTabBar />
          {children}
        </Box>
      </Box>
    </I18nProvider>
  );
}

import React from 'react';
import Box from '@mui/material/Box';
import { redirect } from 'next/navigation';
import { getYouSession } from './you-auth';
import YouTabBar from './you-tab-bar';
import styles from '@/app/profile/[user_id]/profile-page.module.css';

export default async function YouLayout({ children }: { children: React.ReactNode }) {
  const session = await getYouSession();
  if (!session?.user?.id) {
    redirect('/');
  }

  return (
    <Box className={styles.layout}>
      <Box component="main" className={styles.content}>
        <YouTabBar />
        {children}
      </Box>
    </Box>
  );
}

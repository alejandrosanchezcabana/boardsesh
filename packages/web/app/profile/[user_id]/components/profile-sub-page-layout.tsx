'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BackButton from '@/app/components/back-button';
import Logo from '@/app/components/brand/logo';
import styles from '../profile-page.module.css';

interface ProfileSubPageLayoutProps {
  userId: string;
  title: string;
  children: React.ReactNode;
}

export default function ProfileSubPageLayout({ userId, title, children }: ProfileSubPageLayoutProps) {
  return (
    <Box className={styles.layout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl={`/profile/${userId}`} />
        <Logo size="sm" showText={false} />
        <Typography variant="h6" component="h4" className={styles.headerTitle}>
          {title}
        </Typography>
      </Box>
      <Box component="main" className={styles.content} sx={{ pb: 'calc(170px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </Box>
    </Box>
  );
}

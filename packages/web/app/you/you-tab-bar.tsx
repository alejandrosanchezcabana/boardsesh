'use client';

import React, { useCallback } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { usePathname } from 'next/navigation';
import { useLocaleRouter } from '@/app/lib/i18n/use-locale-router';

type YouTab = 'progress' | 'sessions' | 'logbook';

export default function YouTabBar() {
  const router = useLocaleRouter();
  const pathname = usePathname();

  let activeTab: YouTab;
  if (pathname === '/you/sessions') {
    activeTab = 'sessions';
  } else if (pathname === '/you/logbook') {
    activeTab = 'logbook';
  } else {
    activeTab = 'progress';
  }

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, value: YouTab) => {
      const path = value === 'progress' ? '/you' : `/you/${value}`;
      router.push(path, { scroll: false });
    },
    [router],
  );

  return (
    <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
      <Tab label="Progress" value="progress" />
      <Tab label="Sessions" value="sessions" />
      <Tab label="Logbook" value="logbook" />
    </Tabs>
  );
}

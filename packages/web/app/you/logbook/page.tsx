import React from 'react';
import { Metadata } from 'next';
import LogbookFeed from '@/app/components/library/logbook-feed';

export const metadata: Metadata = {
  title: 'Logbook | Boardsesh',
  robots: { index: false, follow: true },
};

export default function YouLogbookPage() {
  return <LogbookFeed />;
}

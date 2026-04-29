import React from 'react';
import { notFound } from 'next/navigation';

import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getAllBoardConfigs } from '@/app/lib/server-board-configs';

import DevelopmentContent from './development-content';

export const metadata = createNoIndexMetadata({
  title: 'Development',
  description: 'Boardsesh hardware test rig debugger (development build only).',
  path: '/development',
});

export default async function DevelopmentPage() {
  // Hard server-side guard: in production builds we never want to load the
  // dev tooling at all. Calling notFound() here also skips the
  // getAllBoardConfigs() fetch below, so we don't pay the work-cost on every
  // production request.
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  // Same data the user-drawer's "Custom Board" flow loads — drives the
  // cascading Board → Layout → Size → Sets → Angle dropdowns in AddEsp32Dialog.
  const boardConfigs = await getAllBoardConfigs();
  return <DevelopmentContent boardConfigs={boardConfigs} />;
}

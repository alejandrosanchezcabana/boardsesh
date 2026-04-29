import React from 'react';

import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getAllBoardConfigs } from '@/app/lib/server-board-configs';

import DevelopmentContent from './development-content';

export const metadata = createNoIndexMetadata({
  title: 'Development',
  description: 'Boardsesh hardware test rig debugger (development build only).',
  path: '/development',
});

export default async function DevelopmentPage() {
  // Same data the user-drawer's "Custom Board" flow loads — drives the
  // cascading Board → Layout → Size → Sets → Angle dropdowns in AddEsp32Dialog.
  const boardConfigs = await getAllBoardConfigs();
  return <DevelopmentContent boardConfigs={boardConfigs} />;
}

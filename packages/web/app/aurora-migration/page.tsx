import React from 'react';
import type { Metadata } from 'next';
import AuroraMigrationContent from './aurora-migration-content';

export const metadata: Metadata = {
  title: 'Migrate from Old Kilter App | Boardsesh',
  description: 'Migrate your Kilter board data to Boardsesh after the Aurora backend shutdown.',
};

export default function AuroraMigrationPage() {
  return <AuroraMigrationContent />;
}

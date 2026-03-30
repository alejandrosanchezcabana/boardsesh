import React from 'react';
import type { Metadata } from 'next';
import { getServerAuthToken } from './lib/auth/server-auth';
import ConsolidatedBoardConfig from './components/setup-wizard/consolidated-board-config';
import { getAllBoardConfigs } from './lib/server-board-configs';
import HomePageContent from './home-page-content';

export const metadata: Metadata = {
  title: 'Boardsesh - LED Climbing Board Training Hub',
  description:
    'Your all-in-one hub for LED climbing board training. Track sessions, control Kilter, Tension, and MoonBoard LEDs via Bluetooth, create playlists, and climb with friends.',
  openGraph: {
    title: 'Boardsesh - LED Climbing Board Training Hub',
    description:
      'Track your climbing, control LED boards, and train with friends.',
    url: 'https://www.boardsesh.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boardsesh - LED Climbing Board Training Hub',
    description:
      'Track your climbing, control LED boards, and train with friends.',
  },
};

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const boardConfigs = await getAllBoardConfigs();

  // Check if user explicitly wants to see the board selector
  if (params.select === 'true') {
    return <ConsolidatedBoardConfig boardConfigs={boardConfigs} />;
  }

  // Read auth cookie to determine if user is authenticated at SSR time
  const authToken = await getServerAuthToken();
  const isAuthenticatedSSR = !!authToken;

  return (
    <HomePageContent
      boardConfigs={boardConfigs}
      isAuthenticatedSSR={isAuthenticatedSSR}
    />
  );
}

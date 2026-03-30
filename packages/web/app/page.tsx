import React from 'react';
import type { Metadata } from 'next';
import { getServerAuthToken } from './lib/auth/server-auth';
import ConsolidatedBoardConfig from './components/setup-wizard/consolidated-board-config';
import { getAllBoardConfigs } from './lib/server-board-configs';
import { getPopularBoardConfigs } from './lib/server-popular-configs';
import HomePageContent from './home-page-content';

export const metadata: Metadata = {
  title: 'Boardsesh - Train smarter on your climbing board',
  description:
    'Track your sends across Kilter, Tension, and MoonBoard. One app for every board.',
  openGraph: {
    title: 'Boardsesh - Train smarter on your climbing board',
    description:
      'One app for Kilter, Tension, and MoonBoard. Track sessions, control LEDs, climb together.',
    url: 'https://www.boardsesh.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boardsesh - Train smarter on your climbing board',
    description:
      'One app for Kilter, Tension, and MoonBoard. Track sessions, control LEDs, climb together.',
  },
};

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const [boardConfigs, popularConfigs] = await Promise.all([
    getAllBoardConfigs(),
    getPopularBoardConfigs(),
  ]);

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
      initialPopularConfigs={popularConfigs}
    />
  );
}

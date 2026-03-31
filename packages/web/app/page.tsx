import React from 'react';
import type { Metadata } from 'next';
import { getAllBoardConfigs } from './lib/server-board-configs';
import { getPopularBoardConfigs } from './lib/server-popular-configs';
import HomePageContent from './home-page-content';

export const revalidate = false;

export const metadata: Metadata = {
  title: 'Boardsesh - Train smarter on your climbing board',
  description:
    'Track your sends across Kilter, Tension, and MoonBoard. One app for your boards.',
  openGraph: {
    title: 'Boardsesh - Train smarter on your climbing board',
    description:
      'Works with Kilter, Tension, and MoonBoard. Track sessions, control LEDs, climb together.',
    url: 'https://www.boardsesh.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boardsesh - Train smarter on your climbing board',
    description:
      'Works with Kilter, Tension, and MoonBoard. Track sessions, control LEDs, climb together.',
  },
};

export default async function Home() {
  const [boardConfigs, popularConfigs] = await Promise.all([
    getAllBoardConfigs(),
    getPopularBoardConfigs(),
  ]);

  return (
    <HomePageContent
      boardConfigs={boardConfigs}
      initialPopularConfigs={popularConfigs}
    />
  );
}

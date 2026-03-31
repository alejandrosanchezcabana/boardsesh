import React from 'react';
import { Metadata } from 'next';
import AboutContent from './about-content';

export const metadata: Metadata = {
  title: 'About | Boardsesh',
  description:
    'One app for every climbing board. Open source, community-driven.',
};

export default function AboutPage() {
  return <AboutContent />;
}

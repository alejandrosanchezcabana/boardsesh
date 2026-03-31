import React from 'react';
import { Metadata } from 'next';
import LegalContent from './legal-content';

export const metadata: Metadata = {
  title: 'Legal & Intellectual Property Policy | Boardsesh',
  description:
    'Legal and intellectual property policy for Boardsesh, including our position on climb data, interoperability, and trademark usage.',
};

export default function LegalPage() {
  return <LegalContent />;
}

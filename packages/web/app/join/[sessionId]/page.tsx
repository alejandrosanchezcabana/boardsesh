import React from 'react';
import type { Metadata } from 'next';
import { BOULDER_GRADES } from '@/app/lib/board-data';
import JoinRedirect from './join-redirect';
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';
import { getSessionOgSummary } from '@/app/lib/seo/dynamic-og-data';

type Props = {
  params: Promise<{ sessionId: string }>;
};

const DIFFICULTY_TO_GRADE: Record<number, string> = Object.fromEntries(
  BOULDER_GRADES.map((g) => [g.difficulty_id, g.font_grade]),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);

  try {
    const summary = await getSessionOgSummary(sessionId);

    if (!summary.found) {
      return { title: 'Session Not Found | Boardsesh' };
    }

    const sessionName = summary.sessionName;
    const participantNames = summary.participantNames.join(', ');
    const grades = summary.gradeRows
      .map((r) => DIFFICULTY_TO_GRADE[r.difficulty])
      .filter(Boolean);
    const gradeRange = grades.length > 0 ? `${grades[0]} - ${grades[grades.length - 1]}` : '';

    const title = `Join ${sessionName} | Boardsesh`;
    const description = participantNames
      ? `${participantNames} sent ${summary.totalSends} climbs${gradeRange ? ` (${gradeRange})` : ''}. Get on the wall!`
      : `Join this climbing session on Boardsesh`;

    const ogImagePath = buildVersionedOgImagePath('/api/og/session', { sessionId, variant: 'join' }, summary.version);

    return {
      title,
      description,
      robots: { index: false, follow: true },
      openGraph: {
        title,
        description,
        type: 'website',
        url: `/join/${sessionId}`,
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: `Join ${sessionName}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return {
      title: 'Join Session | Boardsesh',
      description: 'Join a climbing session on Boardsesh',
      robots: { index: false, follow: true },
    };
  }
}

export default async function JoinSessionPage({ params }: Props) {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);

  return <JoinRedirect sessionId={sessionId} />;
}

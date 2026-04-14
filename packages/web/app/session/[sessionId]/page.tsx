import React from 'react';
import type { Metadata } from 'next';
import { GraphQLClient } from 'graphql-request';
import { getGraphQLHttpUrl } from '@/app/lib/graphql/client';
import { GET_SESSION_DETAIL, type GetSessionDetailQueryResponse } from '@/app/lib/graphql/operations/activity-feed';
import SessionDetailContent from './session-detail-content';

type Props = {
  params: Promise<{ sessionId: string }>;
};

const fetchSessionDetail = React.cache(async (sessionId: string) => {
  const url = getGraphQLHttpUrl();
  const client = new GraphQLClient(url);
  try {
    const data = await client.request<GetSessionDetailQueryResponse>(
      GET_SESSION_DETAIL,
      { sessionId },
    );
    return data.sessionDetail;
  } catch (err) {
    console.error('[SessionDetailPage] Failed to fetch session:', sessionId, err);
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);
  const session = await fetchSessionDetail(sessionId);

  if (!session) {
    return { title: 'Session Not Found | Boardsesh' };
  }

  const participantNames = session.participants
    .map((p) => p.displayName || 'Climber')
    .join(', ');

  const sessionName = session.sessionName || 'Climbing Session';
  const title = `${sessionName} | Boardsesh`;

  let description: string;
  if (session.totalSends > 0 || session.totalFlashes > 0) {
    const stats = `${session.totalSends} send${session.totalSends !== 1 ? 's' : ''}, ${session.totalFlashes} flash${session.totalFlashes !== 1 ? 'es' : ''}`;
    description = participantNames ? `${participantNames} — ${stats}` : stats;
  } else {
    description = participantNames
      ? `${participantNames} climbing on Boardsesh`
      : `${sessionName} on Boardsesh`;
  }

  const ogParams = new URLSearchParams();
  ogParams.set('sessionId', sessionId);
  const ogImage = `/api/og/session?${ogParams.toString()}`;
  const canonicalUrl = `/session/${sessionId}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/session/${sessionId}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SessionDetailPage({ params }: Props) {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);
  const session = await fetchSessionDetail(sessionId);

  return <SessionDetailContent session={session} sessionId={sessionId} />;
}

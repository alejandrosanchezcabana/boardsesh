import React from 'react';
import type { Metadata } from 'next';
import { BOULDER_GRADES } from '@/app/lib/board-data';
import JoinRedirect from './join-redirect';
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';
import { getSessionOgSummary } from '@/app/lib/seo/dynamic-og-data';
import { getServerTranslation } from '@/app/lib/i18n/server';
import { getLocale } from '@/app/lib/i18n/get-locale';
import I18nProvider from '@/app/components/providers/i18n-provider';

type Props = {
  params: Promise<{ sessionId: string }>;
};

const DIFFICULTY_TO_GRADE: Record<number, string> = Object.fromEntries(
  BOULDER_GRADES.map((g) => [g.difficulty_id, g.font_grade]),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);
  const { t } = await getServerTranslation('session');

  const buildJoinHeadline = (leaderName: string | null): string =>
    leaderName ? t('metadata.join.headlineWithLeader', { name: leaderName }) : t('metadata.join.headlineDefault');

  const buildGradeSummary = (grades: string[]): string => {
    if (grades.length === 0) {
      return '';
    }
    if (grades.length === 1) {
      return t('metadata.join.gradeOn', { grade: grades[0] });
    }
    return t('metadata.join.gradeRange', { first: grades[0], last: grades[grades.length - 1] });
  };

  try {
    const summary = await getSessionOgSummary(sessionId);

    if (!summary.found) {
      return { title: `${t('metadata.detail.notFoundTitle')} | Boardsesh` };
    }

    const sessionName = summary.sessionName;
    const grades = summary.gradeRows.map((r) => DIFFICULTY_TO_GRADE[r.difficulty]).filter(Boolean);
    const gradeSummary = buildGradeSummary(grades);
    const joinHeadline = buildJoinHeadline(summary.leaderName);
    let boardInfo: string | null;
    if (summary.boardLabel) {
      boardInfo =
        summary.boardAngle != null
          ? t('metadata.join.boardAtAngle', { boardLabel: summary.boardLabel, angle: summary.boardAngle })
          : summary.boardLabel;
    } else {
      boardInfo = null;
    }

    const title = `${joinHeadline} | Boardsesh`;
    let description: string;
    if (boardInfo) {
      if (summary.totalSends > 0) {
        description = t('metadata.join.descriptionBoardWithSends', {
          count: summary.totalSends,
          boardInfo,
          gradeSummary,
        });
      } else {
        description = t('metadata.join.descriptionBoardNoSends', { boardInfo });
      }
    } else if (sessionName && sessionName !== 'Climbing Session') {
      description = t('metadata.join.descriptionLive', { sessionName });
    } else {
      description = t('metadata.join.descriptionDefault');
    }

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
            alt: joinHeadline,
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
      title: `${t('metadata.join.title')} | Boardsesh`,
      description: t('metadata.join.description'),
      robots: { index: false, follow: true },
    };
  }
}

export default async function JoinSessionPage({ params }: Props) {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);
  const locale = await getLocale();

  const joinUrl = `/api/internal/join/${encodeURIComponent(sessionId)}`;

  return (
    <I18nProvider locale={locale} namespaces={['session']}>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${joinUrl}`} />
      </noscript>
      <JoinRedirect sessionId={sessionId} />
    </I18nProvider>
  );
}

'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import type { CollapsibleSectionConfig } from '@/app/components/collapsible-section/collapsible-section';
import { LogbookSection, useLogbookSummary } from '@/app/components/logbook/logbook-section';
import { CrewLogbookView } from '@/app/components/logbook/crew-logbook-view';
import ClimbSocialSection from '@/app/components/social/climb-social-section';
import ClimbAnalytics from '@/app/components/charts/climb-analytics';
import BoardseshBetaSection from '@/app/components/beta-videos/boardsesh-beta-section';
import BoardseshBetaAddButton from '@/app/components/beta-videos/boardsesh-beta-add-button';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { GET_BETA_LINKS } from '@/app/lib/graphql/operations/beta-links';
import { dedupeBetaLinks, mapBetaLinksResponse } from '@/app/lib/beta-video-url';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import type { Climb } from '@/app/lib/types';

type BuildClimbDetailSectionsProps = {
  climb: Climb;
  climbUuid: string;
  boardType: string;
  angle: number;
  currentClimbDifficulty?: string;
  boardName?: string;
  /** When false, returns empty sections immediately. Used to defer below-fold
   *  rendering until after the drawer open animation completes. */
  enabled?: boolean;
};

export function useBuildClimbDetailSections({
  climb,
  climbUuid,
  boardType,
  angle,
  currentClimbDifficulty,
  boardName,
  enabled: enabledProp = true,
}: BuildClimbDetailSectionsProps): CollapsibleSectionConfig[] {
  const searchParams = useSearchParams();
  const highlightProposalUuid = searchParams.get('proposalUuid') ?? undefined;
  const logbookSummary = useLogbookSummary(climb.uuid);
  const [isAddingBeta, setIsAddingBeta] = useState(false);

  const { data: betaLinks = [] } = useQuery<BetaLink[]>({
    queryKey: ['betaLinks', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      const result = await client.request<{ betaLinks: Parameters<typeof mapBetaLinksResponse>[0] }>(GET_BETA_LINKS, {
        boardType,
        climbUuid,
      });
      return mapBetaLinksResponse(result.betaLinks);
    },
    enabled: enabledProp && !!climbUuid,
    staleTime: 5 * 60 * 1000,
  });
  const betaCount = dedupeBetaLinks(betaLinks).length;

  if (!enabledProp) return [];

  const getLogbookSummaryParts = (): string[] => {
    if (!logbookSummary) return [];

    const parts: string[] = [];
    parts.push(`${logbookSummary.totalAttempts} attempt${logbookSummary.totalAttempts !== 1 ? 's' : ''}`);

    if (logbookSummary.successfulAscents > 0) {
      parts.push(`${logbookSummary.successfulAscents} send${logbookSummary.successfulAscents !== 1 ? 's' : ''}`);
    }

    return parts;
  };

  const betaLabel = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <VideocamOutlined sx={{ fontSize: 16 }} />
      Beta
    </span>
  );
  const betaTitle = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <VideocamOutlined sx={{ fontSize: 22 }} />
      Beta
    </span>
  );

  return [
    {
      key: 'beta',
      label: betaLabel,
      title: betaTitle,
      defaultSummary: 'No videos yet',
      getSummary: () => (betaCount > 0 ? [`${betaCount} video${betaCount !== 1 ? 's' : ''}`] : []),
      defaultActive: !highlightProposalUuid,
      flush: true,
      action: <BoardseshBetaAddButton isAdding={isAddingBeta} onToggle={() => setIsAddingBeta((v) => !v)} />,
      content: (
        <BoardseshBetaSection
          boardType={boardType}
          climbUuid={climbUuid}
          angle={angle}
          isAdding={isAddingBeta}
          onCancelAdd={() => setIsAddingBeta(false)}
          onAddSuccess={() => setIsAddingBeta(false)}
        />
      ),
    },
    {
      key: 'logbook',
      label: 'Your Logbook',
      title: 'Your Logbook',
      defaultSummary: 'No ascents',
      getSummary: getLogbookSummaryParts,
      lazy: true,
      content: <LogbookSection climb={climb} />,
    },
    {
      key: 'crew-logbook',
      label: 'Crew Logbook',
      title: 'Crew Logbook',
      defaultSummary: "See your crew's sends",
      lazy: true,
      content: <CrewLogbookView currentClimb={climb} boardType={boardType} />,
    },
    {
      key: 'community',
      label: 'Community',
      title: 'Community',
      defaultSummary: 'Votes, comments, proposals',
      getSummary: () => ['Votes', 'Comments', 'Proposals'],
      lazy: true,
      defaultActive: !!highlightProposalUuid,
      content: (
        <ClimbSocialSection
          climbUuid={climbUuid}
          boardType={boardType}
          angle={angle}
          currentClimbDifficulty={currentClimbDifficulty}
          boardName={boardName}
          highlightProposalUuid={highlightProposalUuid}
        />
      ),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      title: 'Analytics',
      defaultSummary: 'Ascents, quality trends',
      getSummary: () => ['Ascents', 'Quality', 'Trends'],
      lazy: true,
      content: <ClimbAnalytics climbUuid={climbUuid} boardType={boardType} />,
    },
  ];
}

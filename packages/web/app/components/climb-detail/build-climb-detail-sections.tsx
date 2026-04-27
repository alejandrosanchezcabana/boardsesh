'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import type { CollapsibleSectionConfig } from '@/app/components/collapsible-section/collapsible-section';
import { LogbookSection, useLogbookSummary } from '@/app/components/logbook/logbook-section';
import { CrewLogbookView } from '@/app/components/logbook/crew-logbook-view';
import ClimbSocialSection from '@/app/components/social/climb-social-section';
import ClimbAnalytics from '@/app/components/charts/climb-analytics';
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

  return [
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

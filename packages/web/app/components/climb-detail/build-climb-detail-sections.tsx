"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { CollapsibleSectionConfig } from "@/app/components/collapsible-section/collapsible-section";
import BetaVideos from "@/app/components/beta-videos/beta-videos";
import { LogbookSection, useLogbookSummary } from "@/app/components/logbook/logbook-section";
import ClimbSocialSection from "@/app/components/social/climb-social-section";
import ClimbAnalytics from "@/app/components/charts/climb-analytics";
import type { BetaLink } from "@/app/lib/api-wrappers/sync-api-types";
import { dedupeBetaLinks } from "@/app/lib/instagram-url";
import type { Climb } from "@/app/lib/types";

interface BuildClimbDetailSectionsProps {
  climb: Climb;
  climbUuid: string;
  boardType: string;
  angle: number;
  betaLinks?: BetaLink[];
  currentClimbDifficulty?: string;
  boardName?: string;
  /** When false, returns empty sections immediately. Used to defer below-fold
   *  rendering until after the drawer open animation completes.
   *  Note: only the beta-links network fetch is gated by this flag (via the
   *  `enabled` option on `useQuery`). `useLogbookSummary` is always called
   *  unconditionally because it reads from in-memory context — no network cost. */
  enabled?: boolean;
}

export function useBuildClimbDetailSections({
  climb,
  climbUuid,
  boardType,
  angle,
  betaLinks: initialBetaLinks,
  currentClimbDifficulty,
  boardName,
  enabled: enabledProp = true,
}: BuildClimbDetailSectionsProps): CollapsibleSectionConfig[] {
  const searchParams = useSearchParams();
  const highlightProposalUuid = searchParams.get("proposalUuid") ?? undefined;
  const { data: betaLinks = [] } = useQuery<BetaLink[]>({
    queryKey: ["betaLinks", boardType, climbUuid],
    queryFn: async () => {
      const res = await fetch(`/api/v1/${boardType}/beta/${climbUuid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: enabledProp && !!climbUuid,
    staleTime: 5 * 60 * 1000,
    initialData: initialBetaLinks,
  });
  const uniqueBetaLinks = useMemo(() => dedupeBetaLinks(betaLinks), [betaLinks]);
  const logbookSummary = useLogbookSummary(climb.uuid);

  if (!enabledProp) return [];

  const getLogbookSummaryParts = (): string[] => {
    if (!logbookSummary) return [];

    const parts: string[] = [];
    parts.push(
      `${logbookSummary.totalAttempts} attempt${logbookSummary.totalAttempts !== 1 ? "s" : ""}`,
    );

    if (logbookSummary.successfulAscents > 0) {
      parts.push(
        `${logbookSummary.successfulAscents} send${logbookSummary.successfulAscents !== 1 ? "s" : ""}`,
      );
    }

    return parts;
  };

  return [
    {
      key: "beta",
      label: "Beta Videos",
      title: "Beta Videos",
      defaultSummary: "No videos",
      getSummary: () =>
        uniqueBetaLinks.length > 0
          ? [`${uniqueBetaLinks.length} video${uniqueBetaLinks.length !== 1 ? "s" : ""}`]
          : [],
      lazy: true,
      content: <BetaVideos betaLinks={uniqueBetaLinks} />,
    },
    {
      key: "logbook",
      label: "Your Logbook",
      title: "Your Logbook",
      defaultSummary: "No ascents",
      getSummary: getLogbookSummaryParts,
      lazy: true,
      content: <LogbookSection climb={climb} />,
    },
    {
      key: "community",
      label: "Community",
      title: "Community",
      defaultSummary: "Votes, comments, proposals",
      getSummary: () => ["Votes", "Comments", "Proposals"],
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
      key: "analytics",
      label: "Analytics",
      title: "Analytics",
      defaultSummary: "Ascents, quality trends",
      getSummary: () => ["Ascents", "Quality", "Trends"],
      lazy: true,
      content: <ClimbAnalytics climbUuid={climbUuid} boardType={boardType} />,
    },
  ];
}

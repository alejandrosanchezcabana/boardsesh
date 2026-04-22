import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';

import ClimbDetailPageServer from '@/app/components/climb-detail/climb-detail-page.server';
import { fetchClimbDetailData } from '@/app/lib/data/climb-detail-data.server';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';
import { extractUuidFromSlug } from '@/app/lib/url-utils';
import { buildOgBoardRenderUrl } from '@/app/components/board-renderer/util';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';

interface BoardSlugViewPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export async function generateMetadata(props: BoardSlugViewPageProps): Promise<Metadata> {
  const params = await props.params;

  try {
    const board = await resolveBoardBySlug(params.board_slug);
    if (!board) {
      return { title: 'Climb View | Boardsesh', description: 'View climb details and beta videos' };
    }

    const parsedParams = {
      ...boardToRouteParams(board, Number(params.angle)),
      climb_uuid: extractUuidFromSlug(params.climb_uuid),
    };

    const boardDetails = getBoardDetailsForBoard(parsedParams);
    const currentClimb = await getClimb(parsedParams);

    const climbName = currentClimb.name || `${boardDetails.board_name} Climb`;
    const climbGrade = currentClimb.difficulty || 'Unknown Grade';
    const setter = currentClimb.setter_username || 'Unknown Setter';
    const description = `${climbName} - ${climbGrade} by ${setter}. Quality: ${currentClimb.quality_average || 0}/5. Ascents: ${currentClimb.ascensionist_count || 0}`;
    const title = `${climbName} - ${climbGrade} | Boardsesh`;
    const climbUrl = `/b/${params.board_slug}/${params.angle}/view/${params.climb_uuid}`;

    const ogImagePath = buildOgBoardRenderUrl(boardDetails, currentClimb.frames);

    return {
      title,
      description,
      alternates: { canonical: climbUrl },
      openGraph: {
        title: `${climbName} - ${climbGrade}`,
        description,
        type: 'website',
        url: climbUrl,
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: `${climbName} - ${climbGrade} on ${boardDetails.board_name} board`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${climbName} - ${climbGrade}`,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return {
      title: 'Climb View | Boardsesh',
      description: 'View climb details and beta videos',
    };
  }
}

export default async function BoardSlugViewPage(props: BoardSlugViewPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: extractUuidFromSlug(params.climb_uuid),
  };

  try {
    const boardDetails = getBoardDetailsForBoard(parsedParams);
    const [currentClimb, detailData] = await Promise.all([
      getClimb(parsedParams),
      fetchClimbDetailData({
        boardName: parsedParams.board_name,
        climbUuid: parsedParams.climb_uuid,
        angle: parsedParams.angle,
      }),
    ]);

    if (!currentClimb) {
      notFound();
    }

    scheduleOverlayWarming({ boardDetails, climbs: [currentClimb], variant: 'full' });

    const climbWithProcessedData = {
      ...currentClimb,
      communityGrade: detailData.communityGrade,
    };

    return (
      <ClimbDetailPageServer
        climb={climbWithProcessedData}
        boardDetails={boardDetails}
        betaLinks={detailData.betaLinks}
        climbUuid={parsedParams.climb_uuid}
        boardType={parsedParams.board_name}
        angle={parsedParams.angle}
        currentClimbDifficulty={currentClimb.difficulty ?? undefined}
        boardName={parsedParams.board_name}
      />
    );
  } catch (error) {
    console.error('Error fetching climb view:', error);
    notFound();
  }
}

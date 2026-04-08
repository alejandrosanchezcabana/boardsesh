import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';
import { generateClimbMetadata } from '@/app/lib/climb-metadata';

import ClimbDetailPageServer from '@/app/components/climb-detail/climb-detail-page.server';
import { fetchClimbDetailData } from '@/app/lib/data/climb-detail-data.server';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';

interface BoardSlugViewPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export async function generateMetadata(props: BoardSlugViewPageProps): Promise<Metadata> {
  const params = await props.params;
  return generateClimbMetadata(params, {
    indexable: true,
    fallback: { title: 'Climb View | Boardsesh', description: 'View climb details and beta videos' },
  });
}

export default async function BoardSlugViewPage(props: BoardSlugViewPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: params.climb_uuid,
  };

  try {
    const [boardDetails, currentClimb, detailData] = await Promise.all([
      getBoardDetailsForBoard(parsedParams),
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

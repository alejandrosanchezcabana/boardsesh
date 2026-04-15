import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';

import PlayViewClient from '@/app/[board_name]/[layout_id]/[size_id]/[set_ids]/[angle]/play/[climb_uuid]/play-view-client';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';
import { extractUuidFromSlug } from '@/app/lib/url-utils';
import { buildOgBoardRenderUrl } from '@/app/components/board-renderer/util';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';

interface BoardSlugPlayPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export async function generateMetadata(props: BoardSlugPlayPageProps): Promise<Metadata> {
  const params = await props.params;

  try {
    const board = await resolveBoardBySlug(params.board_slug);
    if (!board) {
      return { title: 'Play Climb | Boardsesh', description: 'Play a climb on your board' };
    }

    const parsedParams = {
      ...boardToRouteParams(board, Number(params.angle)),
      climb_uuid: extractUuidFromSlug(params.climb_uuid),
    };

    const [boardDetails, currentClimb] = await Promise.all([
      getBoardDetailsForBoard(parsedParams),
      getClimb(parsedParams),
    ]);

    const climbName = currentClimb.name || `${boardDetails.board_name} Climb`;
    const climbGrade = currentClimb.difficulty || 'Unknown Grade';
    const setter = currentClimb.setter_username || 'Unknown Setter';
    const description = `${climbName} - ${climbGrade} by ${setter}. Quality: ${currentClimb.quality_average || 0}/5. Ascents: ${currentClimb.ascensionist_count || 0}`;
    const title = `${climbName} - ${climbGrade} | Boardsesh`;
    const canonicalUrl = `/b/${params.board_slug}/${params.angle}/play/${params.climb_uuid}`;

    const ogImagePath = buildOgBoardRenderUrl(boardDetails, currentClimb.frames);

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      robots: { index: false, follow: true },
      openGraph: {
        title: `${climbName} - ${climbGrade}`,
        description,
        type: 'website',
        url: canonicalUrl,
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
      title: 'Play Climb | Boardsesh',
      description: 'Play a climb on your board',
    };
  }
}

export default async function BoardSlugPlayPage(props: BoardSlugPlayPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: extractUuidFromSlug(params.climb_uuid),
  };

  const boardDetails = getBoardDetailsForBoard(parsedParams);

  let initialClimb = null;
  try {
    const climb = await getClimb(parsedParams);
    if (climb) {
      initialClimb = climb;
    }
  } catch {
    // Climb will be loaded from queue context on client
  }

  if (initialClimb) {
    scheduleOverlayWarming({ boardDetails, climbs: [initialClimb], variant: 'full' });
  }

  return (
    <PlayViewClient
      boardDetails={boardDetails}
      initialClimb={initialClimb}
      angle={parsedParams.angle}
    />
  );
}

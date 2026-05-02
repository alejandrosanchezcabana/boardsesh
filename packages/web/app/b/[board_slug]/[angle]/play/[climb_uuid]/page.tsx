import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';

import PlayViewClient from '@/app/[board_name]/[layout_id]/[size_id]/[set_ids]/[angle]/play/[climb_uuid]/play-view-client';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';
import { extractUuidFromSlug } from '@/app/lib/url-utils';
import { buildOgBoardRenderUrl } from '@/app/components/board-renderer/util';
import { getServerTranslation } from '@/app/lib/i18n/server';
import { createPageMetadata } from '@/app/lib/seo/metadata';

type BoardSlugPlayPageProps = {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
};

export async function generateMetadata(props: BoardSlugPlayPageProps): Promise<Metadata> {
  const params = await props.params;
  const { t, locale } = await getServerTranslation('climbs');

  try {
    const board = await resolveBoardBySlug(params.board_slug);
    if (!board) {
      return createPageMetadata({
        title: t('metadata.play.fallbackTitle'),
        description: t('metadata.play.fallbackDescription'),
        locale,
        robots: { index: false, follow: true },
      });
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
    const quality = currentClimb.quality_average || 0;
    const ascents = currentClimb.ascensionist_count || 0;
    const ogImagePath = buildOgBoardRenderUrl(boardDetails, currentClimb.frames);

    return createPageMetadata({
      title: t('metadata.play.title', { climbName, grade: climbGrade }),
      description: t('metadata.play.description', { climbName, grade: climbGrade, setter, quality, ascents }),
      path: `/b/${params.board_slug}/${params.angle}/play/${params.climb_uuid}`,
      locale,
      robots: { index: false, follow: true },
      imagePath: ogImagePath,
      imageAlt: t('metadata.view.imageAlt', { climbName, grade: climbGrade, boardName: boardDetails.board_name }),
    });
  } catch {
    return createPageMetadata({
      title: t('metadata.play.fallbackTitle'),
      description: t('metadata.play.fallbackDescription'),
      locale,
      robots: { index: false, follow: true },
    });
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

  return <PlayViewClient boardDetails={boardDetails} initialClimb={initialClimb} angle={parsedParams.angle} />;
}

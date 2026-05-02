import React from 'react';
import type { BoardRouteParametersWithUuid } from '@/app/lib/types';
import { constructPlayUrlWithSlugs } from '@/app/lib/url-utils';
import { parseRouteParams } from '@/app/lib/url-utils.server';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';

import PlayViewClient from './play-view-client';
import type { Metadata } from 'next';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';
import { buildOgBoardRenderUrl } from '@/app/components/board-renderer/util';
import { getServerTranslation } from '@/app/lib/i18n/server';
import { createPageMetadata } from '@/app/lib/seo/metadata';

export async function generateMetadata(props: { params: Promise<BoardRouteParametersWithUuid> }): Promise<Metadata> {
  const params = await props.params;
  const { t, locale } = await getServerTranslation('climbs');

  try {
    const { parsedParams } = await parseRouteParams(params);
    const boardDetails = getBoardDetailsForBoard(parsedParams);
    const currentClimb = await getClimb(parsedParams);

    const climbName = currentClimb.name || `${boardDetails.board_name} Climb`;
    const climbGrade = currentClimb.difficulty || 'Unknown Grade';
    const setter = currentClimb.setter_username || 'Unknown Setter';
    const quality = currentClimb.quality_average || 0;
    const ascents = currentClimb.ascensionist_count || 0;

    const playUrl =
      boardDetails.layout_name && boardDetails.size_name && boardDetails.set_names
        ? constructPlayUrlWithSlugs(
            parsedParams.board_name,
            boardDetails.layout_name,
            boardDetails.size_name,
            boardDetails.size_description,
            boardDetails.set_names,
            parsedParams.angle,
            parsedParams.climb_uuid,
            currentClimb.name,
          )
        : `/${parsedParams.board_name}/${parsedParams.layout_id}/${parsedParams.size_id}/${parsedParams.set_ids.join(',')}/${parsedParams.angle}/play/${parsedParams.climb_uuid}`;

    const ogImagePath = buildOgBoardRenderUrl(boardDetails, currentClimb.frames);

    return createPageMetadata({
      title: t('metadata.play.title', { climbName, grade: climbGrade }),
      description: t('metadata.play.description', { climbName, grade: climbGrade, setter, quality, ascents }),
      path: playUrl,
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

export default async function PlayPage(props: {
  params: Promise<BoardRouteParametersWithUuid>;
}): Promise<React.JSX.Element> {
  const params = await props.params;

  const { parsedParams } = await parseRouteParams(params);

  const boardDetails = getBoardDetailsForBoard(parsedParams);

  // Try to get the initial climb for SSR
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

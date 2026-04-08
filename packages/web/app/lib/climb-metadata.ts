import { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getClimb } from '@/app/lib/data/queries';
import { constructBoardSlugViewUrl } from '@/app/lib/url-utils';
import type { Climb } from '@/app/lib/types';
import type { ResolvedBoard } from '@/app/lib/board-slug-utils';

interface ClimbMetadataParams {
  board_slug: string;
  angle: string;
  climb_uuid: string;
}

interface ClimbMetadataOptions {
  /** Title suffix appended before "| Boardsesh", e.g. " | Play Mode" */
  titleSuffix?: string;
  /** Whether crawlers should index this page (default: true) */
  indexable?: boolean;
  /** Fallback metadata when resolution fails */
  fallback: { title: string; description: string };
}

interface ResolvedClimbData {
  board: ResolvedBoard;
  parsedParams: {
    board_name: string;
    layout_id: number;
    size_id: number;
    set_ids: number[];
    angle: number;
    climb_uuid: string;
  };
  climb: Climb;
}

/**
 * Resolve board slug params to board details and climb data.
 * Returns null if the board or climb can't be found.
 */
async function resolveClimbData(params: ClimbMetadataParams): Promise<ResolvedClimbData | null> {
  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) return null;

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: params.climb_uuid,
  };

  const climb = await getClimb(parsedParams);
  if (!climb) return null;

  return { board, parsedParams, climb };
}

function buildOgImagePath(parsedParams: ResolvedClimbData['parsedParams']): string {
  const ogParams = new URLSearchParams({
    board_name: parsedParams.board_name,
    layout_id: parsedParams.layout_id.toString(),
    size_id: parsedParams.size_id.toString(),
    set_ids: parsedParams.set_ids.join(','),
    angle: parsedParams.angle.toString(),
    climb_uuid: parsedParams.climb_uuid,
  });
  return `/api/og/climb?${ogParams.toString()}`;
}

/**
 * Generate climb metadata for board-slug pages (view and play).
 * Handles resolution, OG image URL construction, and fallback.
 */
export async function generateClimbMetadata(
  params: ClimbMetadataParams,
  options: ClimbMetadataOptions,
): Promise<Metadata> {
  const { titleSuffix = '', indexable = true, fallback } = options;
  const noIndexRobots = { index: false as const, follow: true as const };

  try {
    const data = await resolveClimbData(params);
    if (!data) {
      return { title: fallback.title, robots: noIndexRobots };
    }

    const { board, parsedParams, climb } = data;
    const boardLabel = parsedParams.board_name.charAt(0).toUpperCase() + parsedParams.board_name.slice(1);
    const climbName = climb.name || `${boardLabel} Climb`;
    const climbGrade = climb.difficulty || 'Unknown Grade';
    const setter = climb.setter_username || 'Unknown Setter';
    const description = `${climbName} - ${climbGrade} by ${setter}. Quality: ${climb.quality_average || 0}/5. Ascents: ${climb.ascensionist_count || 0}`;

    const canonicalUrl = constructBoardSlugViewUrl(
      board.slug,
      parsedParams.angle,
      parsedParams.climb_uuid,
      climb.name,
    );

    const ogImageUrl = buildOgImagePath(parsedParams);
    const titleBase = `${climbName} - ${climbGrade}`;

    return {
      title: `${titleBase}${titleSuffix} | Boardsesh`,
      description,
      ...(!indexable && { robots: noIndexRobots }),
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: titleBase,
        description,
        type: 'website',
        url: canonicalUrl,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${titleBase} on ${boardLabel} board` }],
      },
      twitter: {
        card: 'summary_large_image',
        title: titleBase,
        description,
        images: [ogImageUrl],
      },
    };
  } catch (error) {
    console.error(`Error generating climb metadata:`, error);
    return { ...fallback, robots: noIndexRobots };
  }
}

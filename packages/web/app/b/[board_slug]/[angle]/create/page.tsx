import React from 'react';
import { notFound } from 'next/navigation';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetails } from '@/app/lib/board-constants';
import { getClimb } from '@/app/lib/data/queries';
import CreateClimbForm from '@/app/components/create-climb/create-climb-form';
import {
  MOONBOARD_LAYOUTS,
  MOONBOARD_SETS,
  MoonBoardLayoutKey,
} from '@/app/lib/moonboard-config';
import type { Climb } from '@/app/lib/types';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Climb | Boardsesh',
  description: 'Create a new climb on your climbing board',
};

function getMoonBoardLayoutInfo(layoutId: number) {
  const entry = Object.entries(MOONBOARD_LAYOUTS).find(([, layout]) => layout.id === layoutId);
  if (!entry) return null;
  const [layoutKey, layout] = entry;
  return { layoutKey: layoutKey as MoonBoardLayoutKey, ...layout };
}

function getMoonBoardHoldSetImages(layoutKey: MoonBoardLayoutKey, setIds: number[]): string[] {
  const sets = MOONBOARD_SETS[layoutKey] || [];
  return sets.filter((s) => setIds.includes(s.id)).map((s) => s.imageFile);
}

interface CreatePageProps {
  params: Promise<{ board_slug: string; angle: string }>;
  searchParams: Promise<{ forkFrames?: string; forkName?: string; editClimbUuid?: string }>;
}

export default async function BoardSlugCreatePage(props: CreatePageProps) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = boardToRouteParams(board, Number(params.angle));

  if (parsedParams.board_name === 'moonboard') {
    const layoutInfo = getMoonBoardLayoutInfo(parsedParams.layout_id);
    if (!layoutInfo) {
      return <div>Invalid MoonBoard layout</div>;
    }

    const holdSetImages = getMoonBoardHoldSetImages(layoutInfo.layoutKey, parsedParams.set_ids);

    return (
      <CreateClimbForm
        boardType="moonboard"
        angle={parsedParams.angle}
        layoutFolder={layoutInfo.folder}
        layoutId={parsedParams.layout_id}
        holdSetImages={holdSetImages}
      />
    );
  }

  const boardDetails = await getBoardDetails(parsedParams);

  // When the caller asks to edit an existing climb (drafts, or a recent
  // publish still inside the 24h edit window), load it up-front so the form
  // can seed holds, name, description, and the saved-row tracker on mount.
  // MoonBoard edit-via-URL isn't wired yet; drafts drawer is Aurora-only.
  let editClimb: Climb | undefined;
  if (searchParams.editClimbUuid) {
    try {
      editClimb = await getClimb({
        ...parsedParams,
        climb_uuid: searchParams.editClimbUuid,
      });
    } catch (error) {
      console.error('Failed to load edit climb:', error);
    }
  }

  return (
    <CreateClimbForm
      boardType="aurora"
      angle={parsedParams.angle}
      boardDetails={boardDetails}
      forkFrames={searchParams.forkFrames}
      forkName={searchParams.forkName}
      editClimb={editClimb}
    />
  );
}

import React from 'react';
import type { BoardRouteParameters, Climb } from '@/app/lib/types';
import { getBoardDetails } from '@/app/lib/board-constants';
import { getClimb } from '@/app/lib/data/queries';
import { parseRouteParams } from '@/app/lib/url-utils.server';
import CreateClimbForm from '@/app/components/create-climb/create-climb-form';
import type { MoonBoardLayoutKey } from '@/app/lib/moonboard-config';
import { MOONBOARD_LAYOUTS, MOONBOARD_SETS } from '@/app/lib/moonboard-config';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';

export const metadata: Metadata = {
  title: 'Create Climb | Boardsesh',
  description: 'Create a new climb on your climbing board',
};

type CreateClimbPageProps = {
  params: Promise<BoardRouteParameters>;
  searchParams: Promise<{
    forkFrames?: string;
    forkName?: string;
    forkDescription?: string;
    editClimbUuid?: string;
  }>;
};

// Helper to get MoonBoard layout info from layout ID
function getMoonBoardLayoutInfo(layoutId: number) {
  const entry = Object.entries(MOONBOARD_LAYOUTS).find(([, layout]) => layout.id === layoutId);
  if (!entry) return null;
  const [layoutKey, layout] = entry;
  return { layoutKey: layoutKey as MoonBoardLayoutKey, ...layout };
}

// Helper to get MoonBoard hold set images from set IDs
function getMoonBoardHoldSetImages(layoutKey: MoonBoardLayoutKey, setIds: number[]): string[] {
  const sets = MOONBOARD_SETS[layoutKey] || [];
  return sets.filter((s) => setIds.includes(s.id)).map((s) => s.imageFile);
}

export default async function CreateClimbPage(props: CreateClimbPageProps) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);

  const { parsedParams } = await parseRouteParams(params);

  // Handle MoonBoard separately (no database, different renderer)
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

  // Aurora boards (kilter, tension) - use database
  const boardDetails = getBoardDetails(parsedParams);

  let editClimb: Climb | undefined;
  let editClimbError: string | undefined;
  if (searchParams.editClimbUuid) {
    try {
      const loaded = await getClimb({
        ...parsedParams,
        climb_uuid: searchParams.editClimbUuid,
      });
      if (!loaded) {
        editClimbError = "We couldn't find that climb on this board.";
      } else {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || loaded.userId !== session.user.id) {
          editClimbError = 'You can only edit your own climbs.';
        } else {
          editClimb = loaded;
        }
      }
    } catch (error) {
      console.error('Failed to load edit climb:', error);
      editClimbError = "We couldn't load that climb. It may have been deleted or belongs to a different board.";
    }
  }

  return (
    <CreateClimbForm
      boardType="aurora"
      angle={parsedParams.angle}
      boardDetails={boardDetails}
      forkFrames={searchParams.forkFrames}
      forkName={searchParams.forkName}
      forkDescription={searchParams.forkDescription}
      editClimb={editClimb}
      editClimbError={editClimbError}
    />
  );
}

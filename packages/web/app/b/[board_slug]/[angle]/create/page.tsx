import React from 'react';
import { notFound } from 'next/navigation';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetails } from '@/app/lib/board-constants';
import { getClimb } from '@/app/lib/data/queries';
import CreateClimbForm from '@/app/components/create-climb/create-climb-form';
import { type MoonBoardLayoutKey, MOONBOARD_LAYOUTS, MOONBOARD_SETS } from '@/app/lib/moonboard-config';
import type { Climb } from '@/app/lib/types';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslation('climbs');
  return createNoIndexMetadata({
    title: t('metadata.create.title'),
    description: t('metadata.create.description'),
    locale,
  });
}

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

type CreatePageProps = {
  params: Promise<{ board_slug: string; angle: string }>;
  searchParams: Promise<{
    forkFrames?: string;
    forkName?: string;
    forkDescription?: string;
    editClimbUuid?: string;
  }>;
};

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
      const { t } = await getServerTranslation('climbs');
      return <div>{t('moonboard.invalidLayout')}</div>;
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

  const boardDetails = getBoardDetails(parsedParams);

  // When the caller asks to edit an existing climb (drafts, or a recent
  // publish still inside the 24h edit window), load it up-front so the form
  // can seed holds, name, description, and the saved-row tracker on mount.
  // MoonBoard edit-via-URL isn't wired yet; drafts drawer is Aurora-only.
  //
  // We track `editClimbError` separately so the form can surface a message
  // when the link is broken (expired, wrong board, typo) rather than silently
  // mounting an empty form.
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

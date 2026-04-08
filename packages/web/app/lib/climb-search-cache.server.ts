import 'server-only';

import { track } from '@vercel/analytics/server';
import { revalidateTag } from 'next/cache';
import type { BoardName } from '@/app/lib/types';
import { getBoardClimbSearchTag, getLayoutClimbSearchTag } from '@/app/lib/climb-search-cache';

export type ClimbSearchInvalidationSource = 'internal-route' | 'save-climb-proxy';

interface RevalidateClimbSearchTagsOptions {
  boardName: BoardName;
  layoutId?: number;
  requestHeaders?: Headers;
  source: ClimbSearchInvalidationSource;
}

export async function revalidateClimbSearchTags({
  boardName,
  layoutId,
  requestHeaders,
  source,
}: RevalidateClimbSearchTagsOptions): Promise<void> {
  revalidateTag(getBoardClimbSearchTag(boardName), { expire: 0 });

  if (layoutId) {
    revalidateTag(getLayoutClimbSearchTag(boardName, layoutId), { expire: 0 });
  }

  if (!requestHeaders) {
    return;
  }

  await track(
    'Climb Search Cache Invalidated',
    {
      boardName,
      layoutId: layoutId ?? null,
      source,
      tagCount: layoutId ? 2 : 1,
    },
    { headers: requestHeaders },
  );
}

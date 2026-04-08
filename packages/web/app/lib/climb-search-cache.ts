import type { QueryClient } from '@tanstack/react-query';
import type { BoardName } from '@/app/lib/types';

export const CLIMB_SEARCH_TAG = 'climb-search';

export function getBoardClimbSearchTag(boardName: BoardName): string {
  return `${CLIMB_SEARCH_TAG}:${boardName}`;
}

export function getLayoutClimbSearchTag(boardName: BoardName, layoutId: number): string {
  return `${getBoardClimbSearchTag(boardName)}:${layoutId}`;
}

export async function invalidateClimbSearchQueries(
  queryClient: QueryClient,
  boardName: BoardName,
  layoutId: number,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['climbSearch', boardName, layoutId] }),
    queryClient.invalidateQueries({ queryKey: ['climbSearchCount', boardName, layoutId] }),
  ]);
}

export async function requestClimbSearchRevalidation(
  boardName: BoardName,
  layoutId?: number,
): Promise<void> {
  const response = await fetch('/api/internal/climb-search-cache/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardName, layoutId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to revalidate climb search cache (${response.status})`);
  }
}

export async function refreshClimbSearchAfterSave(
  queryClient: QueryClient,
  boardName: BoardName,
  layoutId: number,
): Promise<void> {
  await invalidateClimbSearchQueries(queryClient, boardName, layoutId);

  try {
    await requestClimbSearchRevalidation(boardName, layoutId);
  } catch (error) {
    console.warn('[Climb Search Cache] Revalidation request failed:', error);
  }
}

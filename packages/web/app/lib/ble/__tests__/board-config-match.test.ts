import { describe, it, expect } from 'vite-plus/test';
import {
  buildSwitchUrl,
  configFromResolvedEntry,
  matchesBoardDetails,
  type ResolvedBoardConfig,
} from '../board-config-match';
import type { ResolvedBoardEntry } from '../resolve-serials';
import type { BoardDetails } from '@/app/lib/types';

function makeBoardDetails(overrides: Partial<BoardDetails> = {}): BoardDetails {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 10,
    set_ids: [1, 20],
    images_to_holds: {} as BoardDetails['images_to_holds'],
    holdsData: {} as BoardDetails['holdsData'],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 0,
    boardWidth: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ResolvedBoardConfig> = {}): ResolvedBoardConfig {
  return {
    boardName: 'kilter',
    layoutId: 1,
    sizeId: 10,
    setIds: '1,20',
    ...overrides,
  };
}

describe('matchesBoardDetails', () => {
  it('returns true on identical config', () => {
    expect(matchesBoardDetails(makeConfig(), makeBoardDetails())).toBe(true);
  });

  it('returns false when boardName differs', () => {
    expect(matchesBoardDetails(makeConfig({ boardName: 'tension' }), makeBoardDetails())).toBe(false);
  });

  it('returns false when layoutId differs', () => {
    expect(matchesBoardDetails(makeConfig({ layoutId: 2 }), makeBoardDetails())).toBe(false);
  });

  it('returns false when sizeId differs', () => {
    expect(matchesBoardDetails(makeConfig({ sizeId: 11 }), makeBoardDetails())).toBe(false);
  });

  it('returns false when setIds differ', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: '1,21' }), makeBoardDetails())).toBe(false);
  });

  it('treats setIds as order-insensitive', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: '20,1' }), makeBoardDetails())).toBe(true);
  });

  it('treats setIds as whitespace-insensitive', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: ' 1 , 20 ' }), makeBoardDetails())).toBe(true);
  });

  it('strips trailing commas in setIds', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: '1,20,' }), makeBoardDetails())).toBe(true);
  });

  it('dedupes repeated setIds', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: '1,1,20,20' }), makeBoardDetails())).toBe(true);
  });

  it('does not match when one side is a strict subset', () => {
    expect(matchesBoardDetails(makeConfig({ setIds: '1' }), makeBoardDetails())).toBe(false);
  });

  // Angle is physically adjustable on almost every board, so it is intentionally
  // excluded from the mismatch comparison — `BoardDetails` doesn't even carry an
  // angle field, and `ResolvedBoardConfig` no longer does either. The mismatch
  // dialog is for layout/size/set drift, not angle drift.
});

describe('configFromResolvedEntry', () => {
  it('extracts the saved-kind shape (slug from board, no angle)', () => {
    const savedEntry: ResolvedBoardEntry = {
      kind: 'saved',
      board: {
        uuid: 'b1',
        slug: 'my-kilter',
        ownerId: 'u1',
        boardType: 'kilter',
        layoutId: 3,
        sizeId: 12,
        setIds: '1,20',
        angle: 40, // present on UserBoard but intentionally not extracted
      } as ResolvedBoardEntry extends { kind: 'saved'; board: infer B } ? B : never,
    };

    expect(configFromResolvedEntry(savedEntry)).toEqual({
      boardName: 'kilter',
      layoutId: 3,
      sizeId: 12,
      setIds: '1,20',
      boardSlug: 'my-kilter',
    });
  });

  it('extracts the recorded-kind shape (slug from join)', () => {
    const recordedEntry: ResolvedBoardEntry = {
      kind: 'recorded',
      config: {
        serialNumber: 'KB-1',
        boardName: 'tension',
        layoutId: 7,
        sizeId: 14,
        setIds: '2,5',
        updatedAt: '2026-04-01T00:00:00.000Z',
        boardUuid: null,
        boardSlug: 'shared-tension',
      },
    };

    expect(configFromResolvedEntry(recordedEntry)).toEqual({
      boardName: 'tension',
      layoutId: 7,
      sizeId: 14,
      setIds: '2,5',
      boardSlug: 'shared-tension',
    });
  });
});

describe('buildSwitchUrl', () => {
  it('uses /b/{slug}/{currentAngle}/list when the entry has a boardSlug', () => {
    const url = buildSwitchUrl(makeConfig({ boardSlug: 'my-kilter' }), 50);
    expect(url).toBe('/b/my-kilter/50/list');
  });

  it('always uses currentAngle (the saved-board default angle is intentionally ignored)', () => {
    // Even if the saved board has a different default angle, "Switch" should
    // keep the user at the angle they're currently using — angle is adjustable.
    const url = buildSwitchUrl(makeConfig({ boardSlug: 'my-kilter' }), 35);
    expect(url).toBe('/b/my-kilter/35/list');
  });

  it('returns null when no boardSlug and getBoardDetails throws (unknown layout)', () => {
    // Layout 99999 is guaranteed not to be in the static board data — getBoardDetails throws.
    const url = buildSwitchUrl(makeConfig({ boardName: 'kilter', layoutId: 99999, sizeId: 99999, setIds: '999' }), 40);
    expect(url).toBeNull();
  });

  it('returns null when boardName is not a known board', () => {
    const url = buildSwitchUrl(makeConfig({ boardName: 'not-a-board', boardSlug: undefined }), 40);
    expect(url).toBeNull();
  });
});

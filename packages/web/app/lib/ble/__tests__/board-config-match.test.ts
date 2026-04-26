import { describe, it, expect } from 'vite-plus/test';
import { configFromResolvedEntry, matchesBoardDetails, type ResolvedBoardConfig } from '../board-config-match';
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

  it('matches even when angle differs (angle is intentionally excluded)', () => {
    // Saved boards carry an angle; recordings do not. The dialog allows
    // reconnecting at a different angle on the same physical controller.
    const config = makeConfig({ angle: 70 });
    const current = makeBoardDetails(); // BoardDetails has no angle field
    expect(matchesBoardDetails(config, current)).toBe(true);
  });
});

describe('configFromResolvedEntry', () => {
  it('extracts the saved-kind shape including angle and slug', () => {
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
        angle: 40,
        // remaining UserBoard fields not relevant to the helper
      } as ResolvedBoardEntry extends { kind: 'saved'; board: infer B } ? B : never,
    };

    expect(configFromResolvedEntry(savedEntry)).toEqual({
      boardName: 'kilter',
      layoutId: 3,
      sizeId: 12,
      setIds: '1,20',
      angle: 40,
      boardSlug: 'my-kilter',
    });
  });

  it('extracts the recorded-kind shape (no angle, slug from join)', () => {
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

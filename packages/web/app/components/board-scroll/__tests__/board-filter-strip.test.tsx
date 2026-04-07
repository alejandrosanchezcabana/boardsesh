import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';

// Mock BoardRenderer (transitive dep via BoardScrollCard)
vi.mock('../../board-renderer/board-renderer', () => ({
  default: () => <div data-testid="board-renderer" />,
}));

// Mock getBoardDetails
vi.mock('@/app/lib/__generated__/product-sizes-data', () => ({
  getBoardDetails: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 8,
    size_id: 25,
    set_ids: [26, 27],
    images_to_holds: { 'test.png': [] },
    holdsData: [],
    edge_left: 0,
    edge_right: 100,
    edge_bottom: 0,
    edge_top: 100,
    boardWidth: 1080,
    boardHeight: 1920,
    supportsMirroring: false,
  })),
}));

// Mock getMoonBoardDetails
vi.mock('@/app/lib/moonboard-config', () => ({
  getMoonBoardDetails: vi.fn(() => null),
}));

// Mock CSS modules - identity proxy so class names are the key themselves
vi.mock('../board-scroll.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

import BoardFilterStrip from '../board-filter-strip';

function makeBoard(overrides?: Partial<UserBoard>): UserBoard {
  return {
    uuid: 'board-1',
    slug: 'my-kilter',
    ownerId: 'user-1',
    boardType: 'kilter',
    layoutId: 8,
    sizeId: 25,
    setIds: '26,27',
    angle: 40,
    name: 'My Kilter',
    locationName: 'The Gym',
    isPublic: true,
    isUnlisted: false,
    hideLocation: false,
    isOwned: true,
    isAngleAdjustable: false,
    createdAt: '2024-01-01T00:00:00Z',
    totalAscents: 0,
    uniqueClimbers: 0,
    followerCount: 0,
    commentCount: 0,
    isFollowedByMe: false,
    ...overrides,
  };
}

const kilterBoard = makeBoard();
const tensionBoard = makeBoard({
  uuid: 'board-2',
  slug: 'my-tension',
  boardType: 'tension',
  name: 'My Tension',
  locationName: 'Home Wall',
});

describe('BoardFilterStrip', () => {
  let onBoardSelect: ReturnType<typeof vi.fn<(board: UserBoard | null) => void>>;

  beforeEach(() => {
    onBoardSelect = vi.fn<(board: UserBoard | null) => void>();
  });

  it('renders "All Boards" card and all board cards', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard, tensionBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    expect(getByText('All Boards')).toBeDefined();
    expect(getByText('My Kilter')).toBeDefined();
    expect(getByText('My Tension')).toBeDefined();
  });

  it('returns null when no boards and not loading', () => {
    const { container } = render(
      <BoardFilterStrip
        boards={[]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders loading state when loading is true', () => {
    const { container, queryByText } = render(
      <BoardFilterStrip
        boards={[]}
        loading={true}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    // Should render (not null) even with empty boards when loading
    expect(container.firstChild).not.toBeNull();
    // The "All" card should not appear while loading (children replaced by skeletons)
    // But the section itself should render
    expect(queryByText('All Boards')).toBeNull();
  });

  it('"All" card is selected when selectedBoard is null', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    const allCard = getByText('All').parentElement!;
    expect(allCard.className).toContain('cardSquareSelected');

    const allName = getByText('All Boards');
    expect(allName.className).toContain('cardNameSelected');
  });

  it('"All" card is not selected when a board is selected', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard]}
        loading={false}
        selectedBoard={kilterBoard}
        onBoardSelect={onBoardSelect}
      />,
    );

    const allSquare = getByText('All').parentElement!;
    expect(allSquare.className).not.toContain('cardSquareSelected');

    const allName = getByText('All Boards');
    expect(allName.className).not.toContain('cardNameSelected');
  });

  it('clicking "All" calls onBoardSelect(null)', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard]}
        loading={false}
        selectedBoard={kilterBoard}
        onBoardSelect={onBoardSelect}
      />,
    );

    fireEvent.click(getByText('All Boards'));
    expect(onBoardSelect).toHaveBeenCalledWith(null);
  });

  it('clicking a board card calls onBoardSelect with the board', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard, tensionBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    // Click the card root (parent of the name element)
    const tensionName = getByText('My Tension');
    const cardRoot = tensionName.parentElement!;
    fireEvent.click(cardRoot);

    expect(onBoardSelect).toHaveBeenCalledWith(tensionBoard);
  });

  it('Enter key on "All" card calls onBoardSelect(null)', () => {
    const { getByRole } = render(
      <BoardFilterStrip
        boards={[kilterBoard]}
        loading={false}
        selectedBoard={kilterBoard}
        onBoardSelect={onBoardSelect}
      />,
    );

    const allButton = getByRole('button');
    fireEvent.keyDown(allButton, { key: 'Enter' });
    expect(onBoardSelect).toHaveBeenCalledWith(null);
  });

  it('Space key on "All" card calls onBoardSelect(null)', () => {
    const { getByRole } = render(
      <BoardFilterStrip
        boards={[kilterBoard]}
        loading={false}
        selectedBoard={kilterBoard}
        onBoardSelect={onBoardSelect}
      />,
    );

    const allButton = getByRole('button');
    fireEvent.keyDown(allButton, { key: ' ' });
    expect(onBoardSelect).toHaveBeenCalledWith(null);
  });

  it('boardTypes disables non-matching boards', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard, tensionBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
        boardTypes={['kilter']}
      />,
    );

    // Kilter card should be clickable
    const kilterName = getByText('My Kilter');
    fireEvent.click(kilterName.parentElement!);
    expect(onBoardSelect).toHaveBeenCalledWith(kilterBoard);

    onBoardSelect.mockClear();

    // Tension card should be disabled (BoardScrollCard disables onClick internally)
    const tensionName = getByText('My Tension');
    const tensionRoot = tensionName.parentElement!;
    fireEvent.click(tensionRoot);
    // BoardScrollCard swallows click when disabled, so onBoardSelect should not fire
    expect(onBoardSelect).not.toHaveBeenCalled();
  });

  it('disabledText is shown on disabled cards', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[tensionBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
        boardTypes={['kilter']}
        disabledText="No climbs"
      />,
    );

    expect(getByText('No climbs')).toBeDefined();
  });

  it('does not disable boards when boardTypes is not provided', () => {
    const { getByText } = render(
      <BoardFilterStrip
        boards={[kilterBoard, tensionBoard]}
        loading={false}
        selectedBoard={null}
        onBoardSelect={onBoardSelect}
      />,
    );

    // Both boards should be clickable
    fireEvent.click(getByText('My Tension').parentElement!);
    expect(onBoardSelect).toHaveBeenCalledWith(tensionBoard);
  });
});

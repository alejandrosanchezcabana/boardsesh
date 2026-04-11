// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import type { BoardDetails } from '@/app/lib/types';

// --- Mocks ---

const {
  isWorkerRenderingSupportedMock,
  renderBoardMock,
  setResolveRenderBoard,
  getResolveRenderBoard,
} = vi.hoisted(() => {
  let resolveRenderBoard: ((bitmap: ImageBitmap) => void) | undefined;
  return {
    isWorkerRenderingSupportedMock: vi.fn(() => true),
    renderBoardMock: vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveRenderBoard = resolve;
        }),
    ),
    setResolveRenderBoard: (fn?: (bitmap: ImageBitmap) => void) => {
      resolveRenderBoard = fn;
    },
    getResolveRenderBoard: () => resolveRenderBoard,
  };
});

vi.mock('@/app/lib/board-render-worker/worker-manager', () => ({
  isWorkerRenderingSupported: isWorkerRenderingSupportedMock,
  renderBoard: renderBoardMock,
}));

vi.mock('@/app/lib/rendering-metrics', () => ({
  trackRenderComplete: vi.fn(),
  trackRenderError: vi.fn(),
  trackListBatchRender: vi.fn(),
}));

vi.mock('../board-image-layers', () => ({
  default: () => <div data-testid="board-image-layers" />,
}));

import BoardCanvasRenderer from '../board-canvas-renderer';

const mockBoardDetails: BoardDetails = {
  board_name: 'kilter',
  layout_id: 1,
  size_id: 7,
  set_ids: [1, 20],
  images_to_holds: { 'product_sizes_layouts_sets/36-1.png': [] },
  holdsData: [],
  edge_left: 0,
  edge_right: 144,
  edge_bottom: 0,
  edge_top: 180,
  boardWidth: 1080,
  boardHeight: 1350,
};

describe('BoardCanvasRenderer cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setResolveRenderBoard(undefined);
    isWorkerRenderingSupportedMock.mockReturnValue(true);
  });

  it('sets initial canvas dimensions from board details', () => {
    const { container } = render(
      <BoardCanvasRenderer
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Canvas should have initial dimensions matching board size
    expect(canvas.width).toBe(mockBoardDetails.boardWidth);
    expect(canvas.height).toBe(mockBoardDetails.boardHeight);
  });

  it('cancelled flag prevents stale renders after unmount', async () => {
    const { container, unmount } = render(
      <BoardCanvasRenderer
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const ctxSpy = vi.fn();
    // Override getContext to spy on drawImage calls
    const originalGetContext = canvas.getContext.bind(canvas);
    canvas.getContext = ((type: string) => {
      const ctx = originalGetContext(type as '2d');
      if (ctx) {
        ctx.drawImage = ctxSpy;
      }
      return ctx;
    }) as typeof canvas.getContext;

    // Unmount before the render promise resolves — sets cancelled = true
    unmount();

    // Now resolve the render promise — the cancelled flag should prevent drawing
    const mockBitmap = {
      width: 1080,
      height: 1350,
      close: vi.fn(),
    } as unknown as ImageBitmap;
    const resolve = getResolveRenderBoard();
    expect(resolve).toBeTypeOf('function');

    await act(async () => {
      resolve?.(mockBitmap);
      // Allow microtask to flush
      await Promise.resolve();
    });

    // drawImage should NOT have been called because the component was unmounted
    // and the cancelled flag prevents the .then() from executing
    expect(ctxSpy).not.toHaveBeenCalled();
  });

  it('resets canvas dimensions to 0 on unmount to release GPU memory', async () => {
    const { container, unmount } = render(
      <BoardCanvasRenderer
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(mockBoardDetails.boardWidth);
    expect(canvas.height).toBe(mockBoardDetails.boardHeight);

    // Wrap unmount in act to flush passive effect cleanups
    await act(async () => {
      unmount();
    });

    // After unmount, canvas dimensions should be 0 to release GPU backing store
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('uses thumbnail dimensions when thumbnail prop is set', () => {
    const { container } = render(
      <BoardCanvasRenderer
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
        thumbnail
      />,
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Thumbnail width is 200, height scales proportionally
    const expectedHeight = Math.round((200 * mockBoardDetails.boardHeight) / mockBoardDetails.boardWidth);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(expectedHeight);
  });

  it('falls back to image layers immediately when worker rendering is unavailable', () => {
    isWorkerRenderingSupportedMock.mockReturnValue(false);

    const { queryByTestId, container } = render(
      <BoardCanvasRenderer
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    expect(queryByTestId('board-image-layers')).toBeTruthy();
    expect(container.querySelector('canvas')).toBeNull();
    expect(renderBoardMock).not.toHaveBeenCalled();
  });
});

'use client';

import { useCallback, useEffect, useRef } from 'react';

export const DRAG_MOVE_THRESHOLD = 10;
export const DRAG_SNAP_THRESHOLD = 30;

export type DragResult = 'expand' | 'collapse' | 'close' | 'none';

/** Pure decision function: determines if finger movement qualifies as a drag gesture. */
export function isDragGestureDetected(startY: number, currentY: number, threshold = DRAG_MOVE_THRESHOLD): boolean {
  return Math.abs(currentY - startY) > threshold;
}

/** Pure decision function: given a drag delta and starting height, returns the drawer action. */
export function computeDragResult(
  deltaY: number,
  startHeight: string,
  isGesture: boolean,
  expandedHeight = '100%',
  threshold = DRAG_SNAP_THRESHOLD,
): DragResult {
  if (!isGesture) return 'none';
  if (deltaY < -threshold) return 'expand';
  if (deltaY > threshold) {
    return startHeight === expandedHeight ? 'collapse' : 'close';
  }
  return 'none';
}

export interface DrawerDragResizeOptions {
  /** Whether the drawer is currently open. Height resets to initialHeight when false. */
  open: boolean;
  /** Called when a drag-down from the initial height should close the drawer. */
  onClose: () => void;
  /** Initial/collapsed height. Defaults to '60%'. */
  initialHeight?: string;
  /** Expanded height. Defaults to '100%'. */
  expandedHeight?: string;
}

export interface DrawerDragResizeResult {
  /** Ref to forward to SwipeableDrawer's paperRef prop. */
  paperRef: React.RefObject<HTMLDivElement | null>;
  /** Touch handlers to spread onto the drag header zone element. */
  dragHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

/**
 * Hook that implements Spotify-style drag-to-resize for bottom drawers.
 *
 * Drag up → expand to 100%.
 * Drag down from 100% → collapse to initial height (60%).
 * Drag down from initial height → close.
 */
export function useDrawerDragResize({
  open,
  onClose,
  initialHeight = '60%',
  expandedHeight = '100%',
}: DrawerDragResizeOptions): DrawerDragResizeResult {
  const paperRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(initialHeight);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(initialHeight);
  const isDragGesture = useRef(false);

  const updateHeight = useCallback((height: string) => {
    heightRef.current = height;
    if (paperRef.current) {
      paperRef.current.style.height = height;
    }
  }, []);

  // Reset height when drawer closes
  useEffect(() => {
    if (!open) {
      updateHeight(initialHeight);
    }
  }, [open, initialHeight, updateHeight]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = heightRef.current;
    isDragGesture.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (Math.abs(e.touches[0].clientY - dragStartY.current) > DRAG_MOVE_THRESHOLD) {
      isDragGesture.current = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragGesture.current) return;
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    if (deltaY < -DRAG_SNAP_THRESHOLD) {
      updateHeight(expandedHeight);
    } else if (deltaY > DRAG_SNAP_THRESHOLD) {
      if (dragStartHeight.current === expandedHeight) {
        updateHeight(initialHeight);
      } else {
        onClose();
      }
    }
  }, [onClose, initialHeight, expandedHeight, updateHeight]);

  return {
    paperRef,
    dragHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

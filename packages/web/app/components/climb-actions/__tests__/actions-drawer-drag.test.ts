import { describe, it, expect } from 'vitest';
import {
  computeDragResult,
  isDragGestureDetected,
  DRAG_MOVE_THRESHOLD,
  DRAG_SNAP_THRESHOLD,
} from '@/app/hooks/use-drawer-drag-resize';

describe('Actions drawer drag-to-resize logic', () => {
  describe('exported constants', () => {
    it('DRAG_MOVE_THRESHOLD is 10', () => {
      expect(DRAG_MOVE_THRESHOLD).toBe(10);
    });

    it('DRAG_SNAP_THRESHOLD is 30', () => {
      expect(DRAG_SNAP_THRESHOLD).toBe(30);
    });
  });

  // ----- Gesture detection (touchmove phase) -----

  describe('isDragGestureDetected', () => {
    it('returns false when finger has not moved', () => {
      expect(isDragGestureDetected(200, 200)).toBe(false);
    });

    it('returns false for movement exactly at the 10px threshold', () => {
      expect(isDragGestureDetected(200, 210)).toBe(false);
      expect(isDragGestureDetected(200, 190)).toBe(false);
    });

    it('returns true for upward movement just beyond threshold (11px)', () => {
      expect(isDragGestureDetected(200, 189)).toBe(true);
    });

    it('returns true for downward movement just beyond threshold (11px)', () => {
      expect(isDragGestureDetected(200, 211)).toBe(true);
    });

    it('returns true for large upward movement', () => {
      expect(isDragGestureDetected(500, 100)).toBe(true);
    });

    it('returns true for large downward movement', () => {
      expect(isDragGestureDetected(100, 500)).toBe(true);
    });

    it('respects a custom moveThreshold', () => {
      expect(isDragGestureDetected(200, 215, 20)).toBe(false);
      expect(isDragGestureDetected(200, 221, 20)).toBe(true);
    });
  });

  // ----- Drag result decision (touchend phase) -----

  describe('computeDragResult', () => {
    it('returns "none" when no drag gesture was detected', () => {
      expect(computeDragResult(-50, '60%', false)).toBe('none');
    });

    it('returns "none" when no gesture, even with large delta', () => {
      expect(computeDragResult(100, '60%', false)).toBe('none');
    });

    it('returns "none" for upward drag exactly at threshold (deltaY = -30)', () => {
      expect(computeDragResult(-30, '60%', true)).toBe('none');
    });

    it('returns "none" for downward drag exactly at threshold (deltaY = 30)', () => {
      expect(computeDragResult(30, '60%', true)).toBe('none');
    });

    it('returns "none" for zero delta with gesture detected', () => {
      expect(computeDragResult(0, '60%', true)).toBe('none');
    });

    it('returns "none" for small upward drag within dead zone', () => {
      expect(computeDragResult(-15, '100%', true)).toBe('none');
    });

    it('returns "none" for small downward drag within dead zone', () => {
      expect(computeDragResult(20, '100%', true)).toBe('none');
    });

    it('returns "expand" for upward drag just beyond threshold (deltaY = -31)', () => {
      expect(computeDragResult(-31, '60%', true)).toBe('expand');
    });

    it('returns "expand" for large upward drag from 60%', () => {
      expect(computeDragResult(-200, '60%', true)).toBe('expand');
    });

    it('returns "expand" for upward drag from 100% (idempotent)', () => {
      expect(computeDragResult(-50, '100%', true)).toBe('expand');
    });

    it('returns "collapse" for downward drag just beyond threshold from 100%', () => {
      expect(computeDragResult(31, '100%', true)).toBe('collapse');
    });

    it('returns "collapse" for large downward drag from 100%', () => {
      expect(computeDragResult(150, '100%', true)).toBe('collapse');
    });

    it('returns "close" for downward drag just beyond threshold from 60%', () => {
      expect(computeDragResult(31, '60%', true)).toBe('close');
    });

    it('returns "close" for large downward drag from 60%', () => {
      expect(computeDragResult(200, '60%', true)).toBe('close');
    });

    it('respects a custom threshold', () => {
      expect(computeDragResult(-40, '60%', true, '100%', 50)).toBe('none');
      expect(computeDragResult(-51, '60%', true, '100%', 50)).toBe('expand');
    });
  });

  // ----- Height reset on close -----

  describe('height reset behavior', () => {
    it('after close, the drawer should reset to 60% for next open', () => {
      const result = computeDragResult(50, '60%', true);
      expect(result).toBe('close');
      const reopenResult = computeDragResult(-50, '60%', true);
      expect(reopenResult).toBe('expand');
    });

    it('after collapse from 100% to 60%, subsequent downward drag closes', () => {
      expect(computeDragResult(50, '100%', true)).toBe('collapse');
      expect(computeDragResult(50, '60%', true)).toBe('close');
    });

    it('full lifecycle: open at 60% -> expand -> collapse -> close', () => {
      expect(computeDragResult(-50, '60%', true)).toBe('expand');
      expect(computeDragResult(50, '100%', true)).toBe('collapse');
      expect(computeDragResult(50, '60%', true)).toBe('close');
    });
  });

  // ----- End-to-end gesture flow -----

  describe('full gesture flow (detection + result)', () => {
    it('small tap (5px movement) produces no action', () => {
      const startY = 300;
      const endY = 305;
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(false);
      expect(computeDragResult(endY - startY, '60%', gesture)).toBe('none');
    });

    it('deliberate upward swipe from 60% expands', () => {
      const startY = 400;
      const endY = 340;
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      expect(computeDragResult(endY - startY, '60%', gesture)).toBe('expand');
    });

    it('deliberate downward swipe from 100% collapses', () => {
      const startY = 200;
      const endY = 260;
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      expect(computeDragResult(endY - startY, '100%', gesture)).toBe('collapse');
    });

    it('deliberate downward swipe from 60% closes', () => {
      const startY = 200;
      const endY = 260;
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      expect(computeDragResult(endY - startY, '60%', gesture)).toBe('close');
    });
  });
});

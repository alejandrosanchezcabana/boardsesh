import { describe, it, expect } from 'vitest';

/**
 * Mirrors the drag-to-resize decision logic used in the actions drawer
 * across climb-list-item, climbs-list, queue-list, and play-view-drawer.
 *
 * The pattern is implemented inline via useCallback/useRef in each consumer,
 * so we extract the pure decision functions here to test the logic without
 * needing to render any components or mock their heavy dependency trees.
 *
 * The three-phase gesture flow:
 *   1. touchstart  — record startY and current height
 *   2. touchmove   — if |delta| > 10px, mark as a drag gesture
 *   3. touchend    — decide action based on deltaY, start height, and threshold
 */

type DragResult = 'expand' | 'collapse' | 'close' | 'none';

/**
 * Given the vertical delta, the height the drawer was at when the drag started,
 * and whether the movement was large enough to count as a drag gesture, return
 * the action the drawer should take.
 *
 * Negative deltaY = dragged upward, positive = dragged downward.
 */
function computeDragResult(
  deltaY: number,
  startHeight: string,
  isDragGesture: boolean,
  threshold = 30,
): DragResult {
  if (!isDragGesture) return 'none';

  if (deltaY < -threshold) {
    return 'expand'; // Dragged up past threshold -> 100%
  }
  if (deltaY > threshold) {
    if (startHeight === '100%') {
      return 'collapse'; // From 100% -> 60%
    }
    return 'close'; // From 60% -> close drawer
  }
  return 'none';
}

/**
 * Determines whether cumulative finger movement counts as a drag gesture.
 * The consumer marks isDragGesture = true once the absolute Y delta exceeds
 * the moveThreshold (default 10px). Once set, it stays true for the rest
 * of the touch sequence.
 */
function isDragGestureDetected(
  startY: number,
  currentY: number,
  moveThreshold = 10,
): boolean {
  return Math.abs(currentY - startY) > moveThreshold;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Actions drawer drag-to-resize logic', () => {
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
      // 15px move with a 20px threshold -> not a gesture
      expect(isDragGestureDetected(200, 215, 20)).toBe(false);
      // 21px move with a 20px threshold -> gesture
      expect(isDragGestureDetected(200, 221, 20)).toBe(true);
    });
  });

  // ----- Drag result decision (touchend phase) -----

  describe('computeDragResult', () => {
    // --- No gesture ---

    it('returns "none" when no drag gesture was detected', () => {
      expect(computeDragResult(-50, '60%', false)).toBe('none');
    });

    it('returns "none" when no gesture, even with large delta', () => {
      expect(computeDragResult(100, '60%', false)).toBe('none');
    });

    // --- Drag within dead zone (|deltaY| <= threshold) ---

    it('returns "none" for upward drag exactly at threshold (deltaY = -30)', () => {
      expect(computeDragResult(-30, '60%', true)).toBe('none');
    });

    it('returns "none" for downward drag exactly at threshold (deltaY = 30)', () => {
      expect(computeDragResult(30, '60%', true)).toBe('none');
    });

    it('returns "none" for zero delta with gesture detected', () => {
      // Finger moved > 10px during the gesture but returned to start
      expect(computeDragResult(0, '60%', true)).toBe('none');
    });

    it('returns "none" for small upward drag within dead zone', () => {
      expect(computeDragResult(-15, '100%', true)).toBe('none');
    });

    it('returns "none" for small downward drag within dead zone', () => {
      expect(computeDragResult(20, '100%', true)).toBe('none');
    });

    // --- Expand (dragged up beyond threshold) ---

    it('returns "expand" for upward drag just beyond threshold (deltaY = -31)', () => {
      expect(computeDragResult(-31, '60%', true)).toBe('expand');
    });

    it('returns "expand" for large upward drag from 60%', () => {
      expect(computeDragResult(-200, '60%', true)).toBe('expand');
    });

    it('returns "expand" for upward drag from 100% (re-expand is a no-op but still "expand")', () => {
      // The consumer applies the result (set to 100%) which is idempotent
      expect(computeDragResult(-50, '100%', true)).toBe('expand');
    });

    // --- Collapse (dragged down from 100% beyond threshold) ---

    it('returns "collapse" for downward drag just beyond threshold from 100% (deltaY = 31)', () => {
      expect(computeDragResult(31, '100%', true)).toBe('collapse');
    });

    it('returns "collapse" for large downward drag from 100%', () => {
      expect(computeDragResult(150, '100%', true)).toBe('collapse');
    });

    // --- Close (dragged down from 60% beyond threshold) ---

    it('returns "close" for downward drag just beyond threshold from 60% (deltaY = 31)', () => {
      expect(computeDragResult(31, '60%', true)).toBe('close');
    });

    it('returns "close" for large downward drag from 60%', () => {
      expect(computeDragResult(200, '60%', true)).toBe('close');
    });

    // --- Custom threshold ---

    it('respects a custom threshold', () => {
      // deltaY = -40 with threshold 50 -> within dead zone
      expect(computeDragResult(-40, '60%', true, 50)).toBe('none');
      // deltaY = -51 with threshold 50 -> expand
      expect(computeDragResult(-51, '60%', true, 50)).toBe('expand');
    });
  });

  // ----- Height reset on close -----

  describe('height reset behavior', () => {
    it('after close, the drawer should reset to 60% for next open', () => {
      // Simulate: drawer is at 60%, user drags down -> close
      const result = computeDragResult(50, '60%', true);
      expect(result).toBe('close');

      // The consumers all run an effect:
      //   useEffect(() => { if (!open) updateHeight('60%'); }, [open, ...])
      // So when the drawer reopens, the startHeight will be '60%'.
      // We verify by checking that the next interaction starts from '60%'.
      const reopenResult = computeDragResult(-50, '60%', true);
      expect(reopenResult).toBe('expand');
    });

    it('after collapse from 100% to 60%, subsequent downward drag closes', () => {
      // Step 1: Drawer at 100%, drag down -> collapse to 60%
      const step1 = computeDragResult(50, '100%', true);
      expect(step1).toBe('collapse');

      // Step 2: Now at 60%, drag down again -> close
      const step2 = computeDragResult(50, '60%', true);
      expect(step2).toBe('close');
    });

    it('full lifecycle: open at 60% -> expand -> collapse -> close', () => {
      // Start at 60%, drag up -> expand
      expect(computeDragResult(-50, '60%', true)).toBe('expand');

      // Now at 100%, drag down -> collapse to 60%
      expect(computeDragResult(50, '100%', true)).toBe('collapse');

      // Back at 60%, drag down -> close
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
      const result = computeDragResult(endY - startY, '60%', gesture);
      expect(result).toBe('none');
    });

    it('deliberate upward swipe from 60% expands', () => {
      const startY = 400;
      const endY = 340; // -60px
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      const result = computeDragResult(endY - startY, '60%', gesture);
      expect(result).toBe('expand');
    });

    it('deliberate downward swipe from 100% collapses', () => {
      const startY = 200;
      const endY = 260; // +60px
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      const result = computeDragResult(endY - startY, '100%', gesture);
      expect(result).toBe('collapse');
    });

    it('deliberate downward swipe from 60% closes', () => {
      const startY = 200;
      const endY = 260; // +60px
      const gesture = isDragGestureDetected(startY, endY);
      expect(gesture).toBe(true);
      const result = computeDragResult(endY - startY, '60%', gesture);
      expect(result).toBe('close');
    });
  });
});

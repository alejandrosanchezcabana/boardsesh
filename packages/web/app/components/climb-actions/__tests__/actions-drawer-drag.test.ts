import { describe, it, expect } from "vite-plus/test";
import {
  computeDragResult,
  isDragGestureDetected,
  DRAG_MOVE_THRESHOLD,
  FLICK_VELOCITY_THRESHOLD,
} from "@/app/hooks/use-drawer-drag-resize";

const INITIAL = 0.6; // 60%
const EXPANDED = 0.9; // 90%
const VP = 1000; // viewport height for easy math

describe("Actions drawer drag-to-resize logic", () => {
  describe("exported constants", () => {
    it("DRAG_MOVE_THRESHOLD is 10", () => {
      expect(DRAG_MOVE_THRESHOLD).toBe(10);
    });

    it("FLICK_VELOCITY_THRESHOLD is 0.5", () => {
      expect(FLICK_VELOCITY_THRESHOLD).toBe(0.5);
    });
  });

  // ----- Gesture detection (touchmove phase) -----

  describe("isDragGestureDetected", () => {
    it("returns false when finger has not moved", () => {
      expect(isDragGestureDetected(200, 200)).toBe(false);
    });

    it("returns false for movement exactly at the 10px threshold", () => {
      expect(isDragGestureDetected(200, 210)).toBe(false);
      expect(isDragGestureDetected(200, 190)).toBe(false);
    });

    it("returns true for movement just beyond threshold (11px)", () => {
      expect(isDragGestureDetected(200, 211)).toBe(true);
      expect(isDragGestureDetected(200, 189)).toBe(true);
    });

    it("returns true for large movements", () => {
      expect(isDragGestureDetected(500, 100)).toBe(true);
      expect(isDragGestureDetected(100, 500)).toBe(true);
    });

    it("respects a custom moveThreshold", () => {
      expect(isDragGestureDetected(200, 215, 20)).toBe(false);
      expect(isDragGestureDetected(200, 221, 20)).toBe(true);
    });
  });

  // ----- Drag result decision (touchend phase) -----

  describe("computeDragResult", () => {
    // The new signature: computeDragResult(currentHeightPx, viewportHeight, velocity, initialFrac, expandedFrac)

    // --- Fast flick always closes ---

    it('returns "close" for fast downward flick regardless of position', () => {
      // At 80% height but fast flick
      expect(computeDragResult(800, VP, 0.6, INITIAL, EXPANDED)).toBe("close");
    });

    it('returns "close" for fast flick even near expanded height', () => {
      expect(computeDragResult(850, VP, 1.0, INITIAL, EXPANDED)).toBe("close");
    });

    it("does not close for slow drag at same position", () => {
      expect(computeDragResult(800, VP, 0.1, INITIAL, EXPANDED)).toBe("expand");
    });

    // --- Position-based snapping (slow drag) ---

    it('returns "close" when dragged below half of initial height', () => {
      // Half of 60% = 30% of viewport = 300px. Below that → close.
      expect(computeDragResult(250, VP, 0, INITIAL, EXPANDED)).toBe("close");
    });

    it('returns "collapse" when dragged just above half of initial height', () => {
      // 350px = 35% — above 30% but below midpoint (75%)
      expect(computeDragResult(350, VP, 0, INITIAL, EXPANDED)).toBe("collapse");
    });

    it('returns "collapse" when at exactly initial height', () => {
      expect(computeDragResult(600, VP, 0, INITIAL, EXPANDED)).toBe("collapse");
    });

    it('returns "expand" when above midpoint between initial and expanded', () => {
      // Midpoint = (60 + 90) / 2 = 75%. 760px > 750px midpoint → expand
      expect(computeDragResult(760, VP, 0, INITIAL, EXPANDED)).toBe("expand");
    });

    it('returns "expand" when at expanded height', () => {
      expect(computeDragResult(900, VP, 0, INITIAL, EXPANDED)).toBe("expand");
    });

    it('returns "expand" when above expanded height', () => {
      expect(computeDragResult(950, VP, 0, INITIAL, EXPANDED)).toBe("expand");
    });

    // --- Edge cases ---

    it('returns "close" at 0 height', () => {
      expect(computeDragResult(0, VP, 0, INITIAL, EXPANDED)).toBe("close");
    });

    it('returns "expand" at midpoint exactly', () => {
      // Midpoint = 750px. At midpoint → expand (>= midpoint)
      expect(computeDragResult(750, VP, 0, INITIAL, EXPANDED)).toBe("expand");
    });

    it('returns "expand" just above midpoint', () => {
      expect(computeDragResult(751, VP, 0, INITIAL, EXPANDED)).toBe("expand");
    });
  });

  // ----- Lifecycle flows -----

  describe("drag lifecycle", () => {
    it("slow drag from 90% to ~70% snaps back to 60%", () => {
      // Started at 90%, dragged to 70% slowly → below midpoint (75%) → collapse
      expect(computeDragResult(700, VP, 0.1, INITIAL, EXPANDED)).toBe("collapse");
    });

    it("slow drag from 90% to ~80% snaps back to 90%", () => {
      // Above midpoint → expand
      expect(computeDragResult(800, VP, 0.1, INITIAL, EXPANDED)).toBe("expand");
    });

    it("slow drag from 60% to ~20% closes", () => {
      // Below half of initial (30%) → close
      expect(computeDragResult(200, VP, 0.1, INITIAL, EXPANDED)).toBe("close");
    });

    it("fast flick from 90% closes", () => {
      expect(computeDragResult(850, VP, 0.6, INITIAL, EXPANDED)).toBe("close");
    });

    it("fast flick from 60% closes", () => {
      expect(computeDragResult(550, VP, 0.8, INITIAL, EXPANDED)).toBe("close");
    });

    it("slow drag from 60% to 50% stays at 60%", () => {
      // 50% > 30% threshold and < 75% midpoint → collapse (i.e. snap to 60%)
      expect(computeDragResult(500, VP, 0.1, INITIAL, EXPANDED)).toBe("collapse");
    });
  });
});

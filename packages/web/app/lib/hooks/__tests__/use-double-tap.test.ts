import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useDoubleTap } from "../use-double-tap";

/**
 * Helper to create a TouchEvent-like object compatible with jsdom.
 * jsdom doesn't support the TouchEvent constructor, so we create a plain Event
 * and add the touch-specific properties.
 */
function createTouchEvent(
  type: "touchstart" | "touchend",
  { touches = [], changedTouches = [] }: { touches?: unknown[]; changedTouches?: unknown[] } = {},
): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", { value: touches });
  Object.defineProperty(event, "changedTouches", { value: changedTouches });
  Object.defineProperty(event, "preventDefault", { value: vi.fn() });
  return event;
}

describe("useDoubleTap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ref and onDoubleClick", () => {
    const { result } = renderHook(() => useDoubleTap(vi.fn()));

    expect(typeof result.current.ref).toBe("function");
    expect(typeof result.current.onDoubleClick).toBe("function");
  });

  it("onDoubleClick calls callback on non-touch device", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    act(() => {
      result.current.onDoubleClick();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("onDoubleClick is no-op after touch events", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element = document.createElement("div");
    act(() => {
      result.current.ref(element);
    });

    // Simulate a single touch event to set isTouchDevice flag
    act(() => {
      vi.setSystemTime(1000);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    // Now onDoubleClick should be a no-op
    act(() => {
      result.current.onDoubleClick();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("double tap within threshold triggers callback", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element = document.createElement("div");
    act(() => {
      result.current.ref(element);
    });

    // First tap
    act(() => {
      vi.setSystemTime(1000);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    // Second tap within threshold (< 300ms)
    act(() => {
      vi.setSystemTime(1200);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("single tap does not trigger callback", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element = document.createElement("div");
    act(() => {
      result.current.ref(element);
    });

    act(() => {
      vi.setSystemTime(1000);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("taps beyond threshold do not trigger callback", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element = document.createElement("div");
    act(() => {
      result.current.ref(element);
    });

    // First tap
    act(() => {
      vi.setSystemTime(1000);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    // Second tap beyond threshold (>= 300ms)
    act(() => {
      vi.setSystemTime(1400);
      element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("callback undefined does not throw", () => {
    const { result } = renderHook(() => useDoubleTap(undefined));

    const element = document.createElement("div");
    act(() => {
      result.current.ref(element);
    });

    // Should not throw when dispatching touch events with undefined callback
    expect(() => {
      act(() => {
        vi.setSystemTime(1000);
        element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
      });
    }).not.toThrow();

    // onDoubleClick should also not throw
    expect(() => {
      act(() => {
        result.current.onDoubleClick();
      });
    }).not.toThrow();
  });

  it("ref attaches touchstart and touchend listeners on mount and detaches on unmount", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element = document.createElement("div");
    const addSpy = vi.spyOn(element, "addEventListener");
    const removeSpy = vi.spyOn(element, "removeEventListener");

    // Attach
    act(() => {
      result.current.ref(element);
    });

    expect(addSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), { passive: true });
    expect(addSpy).toHaveBeenCalledWith("touchend", expect.any(Function), { passive: false });

    // Detach by passing null
    act(() => {
      result.current.ref(null);
    });

    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
  });

  it("ref detaches old element listeners when attaching to new element", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDoubleTap(callback));

    const element1 = document.createElement("div");
    const element2 = document.createElement("div");
    const removeSpy1 = vi.spyOn(element1, "removeEventListener");
    const addSpy2 = vi.spyOn(element2, "addEventListener");

    act(() => {
      result.current.ref(element1);
    });

    act(() => {
      result.current.ref(element2);
    });

    expect(removeSpy1).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeSpy1).toHaveBeenCalledWith("touchend", expect.any(Function));
    expect(addSpy2).toHaveBeenCalledWith("touchstart", expect.any(Function), { passive: true });
    expect(addSpy2).toHaveBeenCalledWith("touchend", expect.any(Function), { passive: false });
  });

  describe("multi-touch filtering (pinch gestures)", () => {
    it("does not trigger callback when two fingers lift during pinch", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDoubleTap(callback));

      const element = document.createElement("div");
      act(() => {
        result.current.ref(element);
      });

      // Two-finger touchstart (pinch begins)
      act(() => {
        vi.setSystemTime(1000);
        element.dispatchEvent(
          createTouchEvent("touchstart", {
            touches: [{}, {}], // Two fingers
          }),
        );
      });

      // First finger lifts — one finger still down
      act(() => {
        vi.setSystemTime(1050);
        element.dispatchEvent(
          createTouchEvent("touchend", {
            touches: [{}], // One finger remaining
          }),
        );
      });

      // Second finger lifts — no fingers remain
      act(() => {
        vi.setSystemTime(1100);
        element.dispatchEvent(
          createTouchEvent("touchend", {
            touches: [], // No fingers remaining
          }),
        );
      });

      // Should NOT have fired the double-tap callback
      expect(callback).not.toHaveBeenCalled();
    });

    it("allows normal double-tap after a completed pinch gesture", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDoubleTap(callback));

      const element = document.createElement("div");
      act(() => {
        result.current.ref(element);
      });

      // Simulate a pinch gesture first
      act(() => {
        vi.setSystemTime(1000);
        element.dispatchEvent(createTouchEvent("touchstart", { touches: [{}, {}] }));
      });
      act(() => {
        vi.setSystemTime(1050);
        element.dispatchEvent(createTouchEvent("touchend", { touches: [{}] }));
      });
      act(() => {
        vi.setSystemTime(1100);
        element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
      });

      // Now do a normal double-tap
      act(() => {
        vi.setSystemTime(2000);
        element.dispatchEvent(createTouchEvent("touchstart", { touches: [{}] }));
      });
      act(() => {
        vi.setSystemTime(2010);
        element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
      });
      act(() => {
        vi.setSystemTime(2200);
        element.dispatchEvent(createTouchEvent("touchstart", { touches: [{}] }));
      });
      act(() => {
        vi.setSystemTime(2210);
        element.dispatchEvent(createTouchEvent("touchend", { touches: [] }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("marks as multi-touch when touchend has remaining fingers", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDoubleTap(callback));

      const element = document.createElement("div");
      act(() => {
        result.current.ref(element);
      });

      // Single-finger touchstart followed by touchend while another finger is still down
      // (e.g., second finger was added mid-gesture)
      act(() => {
        vi.setSystemTime(1000);
        element.dispatchEvent(createTouchEvent("touchstart", { touches: [{}] }));
      });
      act(() => {
        vi.setSystemTime(1050);
        element.dispatchEvent(
          createTouchEvent("touchend", {
            touches: [{}], // Another finger appeared
          }),
        );
      });
      act(() => {
        vi.setSystemTime(1100);
        element.dispatchEvent(
          createTouchEvent("touchend", {
            touches: [],
          }),
        );
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

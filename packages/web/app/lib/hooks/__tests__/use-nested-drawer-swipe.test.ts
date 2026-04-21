import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useNestedDrawerSwipe } from "../use-nested-drawer-swipe";

function createTouchEvent(type: string, clientY: number, touches?: number): TouchEvent {
  const touch = { clientY, clientX: 0, identifier: 0 } as Touch;
  const touchList = touches !== undefined ? Array.from({ length: touches }, () => touch) : [touch];

  return new TouchEvent(type, {
    touches: touchList as unknown as Touch[],
    changedTouches: touchList as unknown as Touch[],
    bubbles: true,
  });
}

function createPaperElement(): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetHeight", { value: 500, configurable: true });
  return el;
}

describe("useNestedDrawerSwipe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a callback ref for the paper element", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));

    expect(typeof result.current.paperRef).toBe("function");
  });

  it("attaches touch event listeners when paper element mounts", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    const addSpy = vi.spyOn(paper, "addEventListener");

    act(() => {
      result.current.paperRef(paper);
    });

    expect(addSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), { passive: true });
    expect(addSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), { passive: true });
    expect(addSpy).toHaveBeenCalledWith("touchend", expect.any(Function), { passive: true });
  });

  it("removes event listeners on cleanup", () => {
    const onClose = vi.fn();
    const { result, unmount } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    const removeSpy = vi.spyOn(paper, "removeEventListener");

    act(() => {
      result.current.paperRef(paper);
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
  });

  it("does not start pulling until delta exceeds 10px", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    // Start touch at y=100
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    // Move only 5px down — should not translate
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 105));
    });

    expect(paper.style.transform).toBe("");
  });

  it("translates paper when pulling down past threshold", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    // Move 30px down — past the 10px dead zone
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 130));
    });

    expect(paper.style.transform).toBe("translateY(30px)");
    expect(paper.style.transition).toBe("none");
  });

  it("calls onClose when pull exceeds close threshold (80px)", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 200));
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchend", 200));
    });

    // onClose is called after 210ms animation delay
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(210);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("snaps back when pull does not exceed close threshold", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    // Pull 50px — past dead zone but under 80px close threshold
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 150));
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchend", 150));
    });

    // Should animate back to original position
    expect(paper.style.transform).toBe("");
    expect(paper.style.transition).toContain("200ms");

    // onClose should NOT be called
    act(() => {
      vi.advanceTimersByTime(210);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(paper.style.transition).toBe("");
  });

  it("cancels pull when user reverses direction", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    // Pull down past dead zone
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 130));
    });
    expect(paper.style.transform).toBe("translateY(30px)");

    // Reverse direction (move above start)
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 90));
    });

    expect(paper.style.transform).toBe("");
    expect(paper.style.transition).toBe("");
  });

  it("does not pull when scroll container is not at top", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    // Create a scroll container inside the paper
    const scrollContainer = document.createElement("div");
    Object.defineProperty(scrollContainer, "scrollTop", { value: 50, configurable: true });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      overflowY: "auto",
    } as CSSStyleDeclaration);

    paper.appendChild(scrollContainer);

    act(() => {
      result.current.paperRef(paper);
    });

    // Touch starts inside the scroll container
    act(() => {
      const e = createTouchEvent("touchstart", 100);
      Object.defineProperty(e, "target", { value: scrollContainer });
      paper.dispatchEvent(e);
    });

    // Pull down
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 200));
    });

    // Should not translate — scroll container hasn't scrolled to top
    expect(paper.style.transform).toBe("");
  });

  it("clears pending timers on unmount", () => {
    const onClose = vi.fn();
    const { result, unmount } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    // Trigger a close gesture
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 200));
    });
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchend", 200));
    });

    // Unmount before the 210ms timer fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(210);
    });

    // onClose should NOT be called after unmount
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses latest onClose callback via ref", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const { result, rerender } = renderHook(({ onClose }) => useNestedDrawerSwipe(onClose), {
      initialProps: { onClose: onClose1 },
    });
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    // Update the callback
    rerender({ onClose: onClose2 });

    // Trigger close gesture
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 200));
    });
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchend", 200));
    });

    act(() => {
      vi.advanceTimersByTime(210);
    });

    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it("does not pull on upward swipe", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 200));
    });

    // Swipe up
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 100));
    });

    expect(paper.style.transform).toBe("");
  });

  it("resets lingering transform on touchend without pull", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNestedDrawerSwipe(onClose));
    const paper = createPaperElement();

    act(() => {
      result.current.paperRef(paper);
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchstart", 100));
    });

    // Small move that doesn't trigger pulling
    act(() => {
      paper.dispatchEvent(createTouchEvent("touchmove", 105));
    });

    act(() => {
      paper.dispatchEvent(createTouchEvent("touchend", 105));
    });

    // Should not have any lingering styles
    expect(paper.style.transform).toBe("");
  });
});

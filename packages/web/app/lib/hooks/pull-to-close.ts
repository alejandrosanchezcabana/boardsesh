'use client';

import { useRef, useCallback, useEffect } from 'react';

// ── Shared constants ──────────────────────────────────────────────────────────

export const DECELERATE_EASING = 'cubic-bezier(0.0, 0, 0.2, 1)';
export const CLOSE_ANIMATION_MS = 200;
export const ANIMATION_DELAY_MS = 210; // CLOSE_ANIMATION_MS + safety margin

// ── Scroll container utility ──────────────────────────────────────────────────

/**
 * Walk up the DOM tree from `target` looking for the nearest element with
 * `overflow-y: auto` or `overflow-y: scroll`. Returns null if none is found
 * before reaching `stopAt` (or the document root).
 */
export function findScrollContainer(
  target: HTMLElement,
  stopAt?: HTMLElement | null,
): HTMLElement | null {
  let el: HTMLElement | null = target;
  while (el && el !== stopAt) {
    const style = window.getComputedStyle(el);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

// ── Pull-to-close state ───────────────────────────────────────────────────────

export interface PullToCloseState {
  startY: number;
  /** Y position where the pull gesture origin is measured from.
   *  When `trackPullOrigin` is true and the touch starts with scroll not at
   *  top, this is set to 0 and updated when scroll first reaches the top. */
  pullOriginY: number;
  scrollContainer: HTMLElement | null;
  isPulling: boolean;
  translateY: number;
}

function createInitialState(): PullToCloseState {
  return { startY: 0, pullOriginY: 0, scrollContainer: null, isPulling: false, translateY: 0 };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UsePullToCloseOptions {
  /** The paper DOM element to apply transforms to. */
  paperEl: HTMLElement | null;
  /** Called when the gesture exceeds the close threshold. */
  onClose: () => void;
  /** Pixels of movement before pulling starts. Default: 10. */
  deadZone?: number;
  /** Pull distance in pixels to trigger close. Default: 80. */
  closeThreshold?: number;
  /**
   * When true, tracks where the scroll container first reaches the top
   * mid-gesture. Useful when the user starts a touch below the fold and
   * scrolls up to the top before pulling down. Default: false.
   */
  trackPullOrigin?: boolean;
  /**
   * When true, offsets the paper transform by the dead zone amount so the
   * paper starts moving from 0px (not from the dead zone distance). Default: false.
   */
  offsetByDeadZone?: boolean;
}

export interface UsePullToCloseReturn {
  /** Mutable ref to the current gesture state. Useful for consumers that need
   *  to read or adjust state (e.g., setting pullOriginY externally). */
  stateRef: React.MutableRefObject<PullToCloseState>;
  /** Call from touchstart. Pass clientY and the scroll container (or null). */
  onTouchStart: (clientY: number, scrollContainer: HTMLElement | null) => void;
  /** Call from touchmove. Pass clientY, touch count, and optional cancel flag. */
  onTouchMove: (clientY: number, touchCount: number, cancelled?: boolean) => void;
  /** Call from touchend. */
  onTouchEnd: () => void;
}

export function usePullToClose({
  paperEl,
  onClose,
  deadZone = 10,
  closeThreshold = 80,
  trackPullOrigin = false,
  offsetByDeadZone = false,
}: UsePullToCloseOptions): UsePullToCloseReturn {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stateRef = useRef<PullToCloseState>(createInitialState());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Capture the paper element in a ref so callbacks don't depend on it
  const paperElRef = useRef(paperEl);
  paperElRef.current = paperEl;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      for (const id of timersRef.current) {
        clearTimeout(id);
      }
      timersRef.current.clear();
    };
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const setTransform = useCallback((translateY: number) => {
    const el = paperElRef.current;
    if (!el) return;
    el.style.transform = `translateY(${translateY}px)`;
    el.style.transition = 'none';
  }, []);

  const clearTransform = useCallback(() => {
    const el = paperElRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.transition = '';
  }, []);

  const onTouchStart = useCallback((clientY: number, scrollContainer: HTMLElement | null) => {
    const atTop = !scrollContainer || scrollContainer.scrollTop <= 0;
    stateRef.current = {
      startY: clientY,
      pullOriginY: trackPullOrigin ? (atTop ? clientY : 0) : clientY,
      scrollContainer,
      isPulling: false,
      translateY: 0,
    };
  }, [trackPullOrigin]);

  const onTouchMove = useCallback((clientY: number, touchCount: number, cancelled?: boolean) => {
    const state = stateRef.current;

    // Multi-touch or externally cancelled — abort any active pull
    if (touchCount > 1 || cancelled) {
      if (state.isPulling) {
        state.isPulling = false;
        state.translateY = 0;
        clearTransform();
      }
      return;
    }

    const atTop = !state.scrollContainer || state.scrollContainer.scrollTop <= 0;
    const movingDown = clientY > state.startY;

    if (atTop && movingDown) {
      // Record where we first hit scroll top (for trackPullOrigin)
      if (trackPullOrigin && !state.pullOriginY) {
        state.pullOriginY = clientY;
      }

      const origin = trackPullOrigin ? state.pullOriginY : state.startY;
      const deltaY = clientY - origin;

      if (!state.isPulling && deltaY > deadZone) {
        state.isPulling = true;
      }
      if (state.isPulling) {
        const pullDistance = offsetByDeadZone ? deltaY - deadZone : deltaY;
        state.translateY = pullDistance;
        setTransform(pullDistance);
      }
    } else if (state.isPulling) {
      // User reversed direction or scrolled — cancel pull
      state.isPulling = false;
      state.translateY = 0;
      clearTransform();
    }
  }, [deadZone, trackPullOrigin, offsetByDeadZone, setTransform, clearTransform]);

  const onTouchEnd = useCallback(() => {
    const state = stateRef.current;
    const el = paperElRef.current;

    if (!state.isPulling) {
      // Reset any lingering transform
      if (state.translateY > 0) {
        clearTransform();
      }
      return;
    }

    if (state.translateY > closeThreshold && el) {
      // Animate off-screen then close
      const targetY = el.offsetHeight;
      el.style.transition = `transform ${CLOSE_ANIMATION_MS}ms ${DECELERATE_EASING}`;
      el.style.transform = `translateY(${targetY}px)`;
      scheduleTimer(() => {
        onCloseRef.current();
      }, ANIMATION_DELAY_MS);
    } else if (el) {
      // Snap back
      el.style.transition = `transform ${CLOSE_ANIMATION_MS}ms ${DECELERATE_EASING}`;
      el.style.transform = '';
      scheduleTimer(() => {
        const currentEl = paperElRef.current;
        if (currentEl) {
          currentEl.style.transition = '';
        }
      }, ANIMATION_DELAY_MS);
    }

    state.isPulling = false;
    state.translateY = 0;
  }, [closeThreshold, scheduleTimer, clearTransform]);

  return { stateRef, onTouchStart, onTouchMove, onTouchEnd };
}

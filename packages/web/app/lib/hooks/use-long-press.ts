import { useCallback, useEffect, useRef, type RefCallback } from 'react';

const DEFAULT_THRESHOLD_MS = 500;
const DEFAULT_MOVE_THRESHOLD_PX = 10;

type UseLongPressOptions = {
  thresholdMs?: number;
  moveThresholdPx?: number;
};

type UseLongPressResult<E extends HTMLElement> = {
  ref: RefCallback<E>;
  /**
   * Call from the element's click handler before doing anything else.
   * Returns `true` (and clears the flag) when a long-press just fired —
   * the caller should bail so the long-press doesn't double up with a tap.
   */
  consumeLongPress: () => boolean;
};

/**
 * Pointer-event-based long-press detector. Attach `ref` to any element to
 * detect a held press of `thresholdMs`. A drag past `moveThresholdPx` cancels
 * the press. The synthesized click that follows a long-press is suppressed
 * by checking `consumeLongPress()` from inside the element's click handler.
 */
export function useLongPress<E extends HTMLElement = HTMLElement>(
  callback: (() => void) | undefined,
  { thresholdMs = DEFAULT_THRESHOLD_MS, moveThresholdPx = DEFAULT_MOVE_THRESHOLD_PX }: UseLongPressOptions = {},
): UseLongPressResult<E> {
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const elementRef = useRef<E | null>(null);

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return;
      longPressFiredRef.current = false;
      startPosRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        callbackRef.current?.();
      }, thresholdMs);
    },
    [thresholdMs],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = event.clientX - startPosRef.current.x;
      const dy = event.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > moveThresholdPx) {
        clearTimer();
      }
    },
    [clearTimer, moveThresholdPx],
  );

  const handlePointerUp = useCallback(() => clearTimer(), [clearTimer]);
  const handlePointerCancel = useCallback(() => clearTimer(), [clearTimer]);

  const handleContextMenu = useCallback((event: Event) => {
    // Suppress the right-click / iOS callout menu so a long-press doesn't
    // surface the system context menu on top of the drawer we're opening.
    event.preventDefault();
  }, []);

  const ref: RefCallback<E> = useCallback(
    (node) => {
      if (elementRef.current) {
        elementRef.current.removeEventListener('pointerdown', handlePointerDown);
        elementRef.current.removeEventListener('pointermove', handlePointerMove);
        elementRef.current.removeEventListener('pointerup', handlePointerUp);
        elementRef.current.removeEventListener('pointercancel', handlePointerCancel);
        elementRef.current.removeEventListener('pointerleave', handlePointerCancel);
        elementRef.current.removeEventListener('contextmenu', handleContextMenu);
      }
      elementRef.current = node;
      if (node) {
        node.addEventListener('pointerdown', handlePointerDown);
        node.addEventListener('pointermove', handlePointerMove);
        node.addEventListener('pointerup', handlePointerUp);
        node.addEventListener('pointercancel', handlePointerCancel);
        node.addEventListener('pointerleave', handlePointerCancel);
        node.addEventListener('contextmenu', handleContextMenu);
      }
    },
    [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleContextMenu],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const consumeLongPress = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { ref, consumeLongPress };
}

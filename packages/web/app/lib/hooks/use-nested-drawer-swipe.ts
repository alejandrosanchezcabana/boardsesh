'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePullToClose, findScrollContainer } from './pull-to-close';

/**
 * Custom swipe-to-close for nested disablePortal drawers.
 * MUI's built-in swipe doesn't work for these because the parent drawer's
 * document-level touchstart handler claims the touch first. This hook
 * attaches native event listeners directly to the Paper element so the
 * entire drawer surface (header, drag handle, body) is swipeable.
 */
export function useNestedDrawerSwipe(onClose: () => void) {
  // Track the Paper DOM element via state so the effect re-runs when it mounts.
  // SwipeableDrawer calls paperRef(node) when the Paper mounts/unmounts.
  const [paperEl, setPaperEl] = useState<HTMLDivElement | null>(null);
  const paperRef = useCallback((node: HTMLDivElement | null) => {
    setPaperEl(node);
  }, []);

  const { onTouchStart, onTouchMove, onTouchEnd } = usePullToClose({
    paperEl,
    onClose,
    // deadZone: 10, closeThreshold: 80 — defaults match
  });

  useEffect(() => {
    if (!paperEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      const scrollContainer = findScrollContainer(e.target as HTMLElement, paperEl);
      onTouchStart(e.touches[0].clientY, scrollContainer);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      onTouchMove(e.touches[0].clientY, e.touches.length);
    };

    const handleTouchEnd = () => {
      onTouchEnd();
    };

    paperEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    paperEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    paperEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      paperEl.removeEventListener('touchstart', handleTouchStart);
      paperEl.removeEventListener('touchmove', handleTouchMove);
      paperEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [paperEl, onTouchStart, onTouchMove, onTouchEnd]);

  return { paperRef };
}

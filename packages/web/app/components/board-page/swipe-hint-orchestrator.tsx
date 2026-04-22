'use client';

import { useEffect, useRef } from 'react';
import { getPreference, setPreference } from '@/app/lib/user-preferences-db';

const PREF_KEY = 'swipeHint:climbListSeen' as const;
const INITIAL_DELAY_MS = 1500;
const PEEK_DISTANCE = 60; // Matches SHORT_SWIPE_THRESHOLD in climb-list-item.tsx
const SLIDE_OUT_MS = 400;
const HOLD_MS = 600;
const SLIDE_BACK_MS = 300;
const GAP_BETWEEN_MS = 300;
const REPEAT_COUNT = 2;

/**
 * Plays a one-time swipe-hint animation on the first climb list item.
 * Briefly slides the item left twice to reveal the "add to queue" action,
 * then slides it back. Uses the Web Animations API for compositor-thread
 * performance. Renders no visible DOM.
 */
export default function SwipeHintOrchestrator() {
  const animationsRef = useRef<Animation[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      const seen = await getPreference<boolean>(PREF_KEY);
      if (cancelled || seen) return;
      if (!window.matchMedia('(pointer: coarse)').matches) return;

      timer = setTimeout(async () => {
        if (cancelled) return;

        const contentEl = document.querySelector<HTMLElement>('#onboarding-climb-card [data-swipe-content]');
        const actionEl = document.querySelector<HTMLElement>('#onboarding-climb-card [data-swipe-right-action]');
        if (!contentEl || !actionEl) return;

        const iconLayer = actionEl.firstElementChild as HTMLElement | null;

        try {
          for (let i = 0; i < REPEAT_COUNT; i++) {
            if (cancelled) return;

            // Show action layer
            actionEl.style.visibility = 'visible';
            if (iconLayer) iconLayer.style.opacity = '1';

            // Slide out
            const slideOut = contentEl.animate(
              [{ transform: 'translateX(0)' }, { transform: `translateX(-${PEEK_DISTANCE}px)` }],
              { duration: SLIDE_OUT_MS, easing: 'ease-out', fill: 'forwards' },
            );
            const fadeIn = actionEl.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: SLIDE_OUT_MS,
              easing: 'ease-out',
              fill: 'forwards',
            });
            animationsRef.current.push(slideOut, fadeIn);

            await slideOut.finished;
            if (cancelled) return;

            // Hold
            await new Promise<void>((r) => {
              timer = setTimeout(r, HOLD_MS);
            });
            if (cancelled) return;

            // Slide back
            const slideBack = contentEl.animate(
              [{ transform: `translateX(-${PEEK_DISTANCE}px)` }, { transform: 'translateX(0)' }],
              { duration: SLIDE_BACK_MS, easing: 'ease-out', fill: 'forwards' },
            );
            const fadeOut = actionEl.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: SLIDE_BACK_MS,
              easing: 'ease-out',
              fill: 'forwards',
            });
            animationsRef.current.push(slideBack, fadeOut);

            await slideBack.finished;
            if (cancelled) return;

            // Clean up inline styles
            contentEl.style.transform = '';
            actionEl.style.opacity = '';
            actionEl.style.visibility = '';
            if (iconLayer) iconLayer.style.opacity = '';

            // Gap before next repeat
            if (i < REPEAT_COUNT - 1) {
              await new Promise<void>((r) => {
                timer = setTimeout(r, GAP_BETWEEN_MS);
              });
            }
          }

          if (!cancelled) {
            void setPreference(PREF_KEY, true);
          }
        } catch {
          // Animation cancelled
        }
      }, INITIAL_DELAY_MS);
    };

    void run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      for (const anim of animationsRef.current) anim.cancel();
      animationsRef.current = [];
    };
  }, []);

  return null;
}

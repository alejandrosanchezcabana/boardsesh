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

/** Window event that asks the orchestrator to replay the hint animation on demand. */
export const CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT = 'swipe-hint:climb-list-replay';

export type ClimbListSwipeHintReplayDetail = {
  /** CSS selector for the climb card to animate. Defaults to #onboarding-climb-card. */
  targetSelector?: string;
};

export const dispatchClimbListSwipeHintReplay = (detail: ClimbListSwipeHintReplayDetail = {}): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, { detail }));
};

type PlayOptions = {
  respectSeen: boolean;
  mobileOnly: boolean;
  targetSelector?: string;
};

const DEFAULT_TARGET = '#onboarding-climb-card';

/**
 * Plays the swipe-hint animation on #onboarding-climb-card. Returns a function
 * that cancels in-flight animations if invoked before they finish.
 */
function playSwipeHint(opts: PlayOptions, animationsRef: React.MutableRefObject<Animation[]>): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    if (opts.respectSeen) {
      const seen = await getPreference<boolean>(PREF_KEY);
      if (cancelled || seen) return;
    }
    if (opts.mobileOnly && !window.matchMedia('(pointer: coarse)').matches) return;

    await new Promise<void>((r) => {
      timer = setTimeout(r, INITIAL_DELAY_MS);
    });
    if (cancelled) return;

    const target = opts.targetSelector ?? DEFAULT_TARGET;
    const contentEl = document.querySelector<HTMLElement>(`${target} [data-swipe-content]`);
    const actionEl = document.querySelector<HTMLElement>(`${target} [data-swipe-right-action]`);
    if (!contentEl || !actionEl) return;

    const iconLayer = actionEl.firstElementChild as HTMLElement | null;

    try {
      for (let i = 0; i < REPEAT_COUNT; i++) {
        if (cancelled) return;

        actionEl.style.visibility = 'visible';
        if (iconLayer) iconLayer.style.opacity = '1';

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

        await new Promise<void>((r) => {
          timer = setTimeout(r, HOLD_MS);
        });
        if (cancelled) return;

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

        contentEl.style.transform = '';
        actionEl.style.opacity = '';
        actionEl.style.visibility = '';
        if (iconLayer) iconLayer.style.opacity = '';

        if (i < REPEAT_COUNT - 1) {
          await new Promise<void>((r) => {
            timer = setTimeout(r, GAP_BETWEEN_MS);
          });
        }
      }

      if (!cancelled && opts.respectSeen) {
        void setPreference(PREF_KEY, true);
      }
    } catch {
      // Animation cancelled
    }
  };

  void run();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    for (const anim of animationsRef.current) anim.cancel();
    animationsRef.current = [];
  };
}

/**
 * Plays a one-time swipe-hint animation on the first climb list item.
 * Briefly slides the item left twice to reveal the "add to queue" action,
 * then slides it back. Uses the Web Animations API for compositor-thread
 * performance. Renders no visible DOM.
 *
 * Also listens for `swipe-hint:climb-list-replay` to replay on demand
 * (used by the onboarding tour).
 */
export default function SwipeHintOrchestrator() {
  const animationsRef = useRef<Animation[]>([]);

  useEffect(() => {
    const cancel = playSwipeHint({ respectSeen: true, mobileOnly: true }, animationsRef);
    return cancel;
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      for (const anim of animationsRef.current) anim.cancel();
      animationsRef.current = [];
      const detail = (e as CustomEvent<ClimbListSwipeHintReplayDetail>).detail ?? {};
      playSwipeHint({ respectSeen: false, mobileOnly: false, targetSelector: detail.targetSelector }, animationsRef);
    };
    window.addEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
    return () => window.removeEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
  }, []);

  return null;
}

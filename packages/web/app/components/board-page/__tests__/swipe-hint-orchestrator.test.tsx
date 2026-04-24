// @vitest-environment jsdom
/* eslint-disable import/first -- vi.hoisted mocks must appear before imports they mock. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, act } from '@testing-library/react';
import React from 'react';

const { mockGetPreference, mockSetPreference } = vi.hoisted(() => ({
  mockGetPreference: vi.fn<(key: string) => Promise<unknown>>(async () => null),
  mockSetPreference: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => undefined),
}));

vi.mock('@/app/lib/user-preferences-db', () => ({
  getPreference: mockGetPreference,
  setPreference: mockSetPreference,
}));

import SwipeHintOrchestrator, {
  CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT,
  dispatchClimbListSwipeHintReplay,
} from '../swipe-hint-orchestrator';
/* eslint-enable import/first */

// ---- Test harness ---------------------------------------------------------

/**
 * Fake Animation returned by our stubbed Element.prototype.animate. Exposes
 * the options it was created with and a way to resolve its `finished`
 * promise on demand.
 */
type FakeAnimation = {
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
  finished: Promise<void>;
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  options: number | KeyframeAnimationOptions | undefined;
};

let createdAnimations: FakeAnimation[] = [];

function installAnimateStub() {
  createdAnimations = [];
  const originalAnimate = (Element.prototype as Element & { animate?: unknown }).animate;
  (Element.prototype as unknown as { animate: unknown }).animate = function (
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ) {
    let resolveFinished: () => void = () => {};
    const finished = new Promise<void>((r) => {
      resolveFinished = r;
    });
    const anim: FakeAnimation = {
      cancel: vi.fn(),
      finish: () => resolveFinished(),
      finished,
      keyframes,
      options,
    };
    createdAnimations.push(anim);
    // Auto-resolve on next microtask so the orchestrator's multi-phase loop
    // can progress without needing explicit driving in most tests.
    queueMicrotask(() => resolveFinished());
    return anim as unknown as Animation;
  };
  return () => {
    (Element.prototype as unknown as { animate: unknown }).animate = originalAnimate;
  };
}

function buildTargetDom(targetId = 'onboarding-climb-card') {
  const card = document.createElement('div');
  card.id = targetId;
  const content = document.createElement('div');
  content.setAttribute('data-swipe-content', '');
  const action = document.createElement('div');
  action.setAttribute('data-swipe-right-action', '');
  const icon = document.createElement('span');
  action.appendChild(icon);
  card.appendChild(content);
  card.appendChild(action);
  document.body.appendChild(card);
  return { card, content, action, icon };
}

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

let restoreAnimate: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  restoreAnimate = installAnimateStub();
  stubMatchMedia(true); // default: coarse pointer, mobile
});

afterEach(() => {
  restoreAnimate();
});

// ---- Tests ----------------------------------------------------------------

describe('dispatchClimbListSwipeHintReplay', () => {
  it('dispatches the replay event on window with the provided targetSelector', () => {
    const handler = vi.fn();
    window.addEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
    dispatchClimbListSwipeHintReplay({ targetSelector: '#custom-target' });
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent<{ targetSelector?: string }>;
    expect(event.detail?.targetSelector).toBe('#custom-target');
    window.removeEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
  });

  it('dispatches with empty detail when no options passed', () => {
    const handler = vi.fn();
    window.addEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
    dispatchClimbListSwipeHintReplay();
    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent<{ targetSelector?: string }>;
    expect(event.detail?.targetSelector).toBeUndefined();
    window.removeEventListener(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, handler);
  });
});

describe('SwipeHintOrchestrator — initial auto-play', () => {
  it('skips when preference says seen', async () => {
    mockGetPreference.mockResolvedValueOnce(true);
    buildTargetDom();
    render(<SwipeHintOrchestrator />);

    // Let effects + microtasks flush; since respectSeen=true short-circuits,
    // no animation should be created.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createdAnimations.length).toBe(0);
  });

  it('skips when not on a coarse-pointer device', async () => {
    stubMatchMedia(false); // fine pointer
    mockGetPreference.mockResolvedValueOnce(null);
    buildTargetDom();
    render(<SwipeHintOrchestrator />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createdAnimations.length).toBe(0);
  });
});

describe('SwipeHintOrchestrator — replay event', () => {
  it('plays the hint on demand, bypassing the seen preference', async () => {
    vi.useFakeTimers();
    mockGetPreference.mockResolvedValueOnce(true); // seen, but replay should still animate
    buildTargetDom();

    render(<SwipeHintOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });

    // The initial auto-play path respects the seen preference and does
    // nothing — confirm no animations before we dispatch replay.
    expect(createdAnimations.length).toBe(0);

    act(() => {
      window.dispatchEvent(new CustomEvent(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, { detail: {} }));
    });
    // Flush the initial-delay timeout so the animation loop actually starts.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should have created animations on content + action elements.
    expect(createdAnimations.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('bypasses the mobile-only gate on replay (fine-pointer devices animate too)', async () => {
    vi.useFakeTimers();
    stubMatchMedia(false); // fine pointer — initial path skips
    buildTargetDom();

    render(<SwipeHintOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(createdAnimations.length).toBe(0);

    act(() => {
      window.dispatchEvent(new CustomEvent(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, { detail: {} }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(createdAnimations.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('animates the target specified in the replay event payload', async () => {
    vi.useFakeTimers();
    buildTargetDom('onboarding-climb-card'); // default
    buildTargetDom('onboarding-climb-card-2');

    render(<SwipeHintOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });
    createdAnimations = [];

    // Replay targeting card-2 — the animations should have been created on
    // content/action inside #onboarding-climb-card-2.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, {
          detail: { targetSelector: '#onboarding-climb-card-2' },
        }),
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(createdAnimations.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('does nothing when the target selector has no matching element', async () => {
    vi.useFakeTimers();
    mockGetPreference.mockResolvedValue(true); // seen — initial auto-play skips
    buildTargetDom('onboarding-climb-card');
    render(<SwipeHintOrchestrator />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createdAnimations.length).toBe(0);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(CLIMB_LIST_SWIPE_HINT_REPLAY_EVENT, {
          detail: { targetSelector: '#does-not-exist' },
        }),
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Replay fired for a missing target — no animations were created.
    expect(createdAnimations.length).toBe(0);
    vi.useRealTimers();
  });
});

describe('SwipeHintOrchestrator — cancellation', () => {
  it('cancels outstanding animations on unmount', async () => {
    vi.useFakeTimers();
    mockGetPreference.mockResolvedValueOnce(null);
    buildTargetDom();

    const { unmount } = render(<SwipeHintOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });
    // Drive the initial auto-play past its delay so animations are scheduled.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const createdBeforeUnmount = createdAnimations.slice();
    unmount();

    // Every animation that was created must have been cancelled.
    for (const anim of createdBeforeUnmount) {
      expect(anim.cancel).toHaveBeenCalled();
    }
    vi.useRealTimers();
  });
});

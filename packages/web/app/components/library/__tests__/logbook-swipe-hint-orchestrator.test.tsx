import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

const getPreferenceMock = vi.fn();
const setPreferenceMock = vi.fn();

vi.mock('@/app/lib/user-preferences-db', () => ({
  getPreference: (...args: unknown[]) => getPreferenceMock(...args),
  setPreference: (...args: unknown[]) => setPreferenceMock(...args),
}));

import LogbookSwipeHintOrchestrator from '../logbook-swipe-hint-orchestrator';

type FakeAnimation = {
  finished: Promise<void>;
  cancel: () => void;
  resolve: () => void;
  cancelled: boolean;
};

function installFakeAnimations() {
  const animations: FakeAnimation[] = [];
  const animate = vi.fn(function (this: Element) {
    let resolveFn!: () => void;
    const finished = new Promise<void>((r) => { resolveFn = r; });
    const anim: FakeAnimation = {
      finished,
      cancelled: false,
      cancel() {
        anim.cancelled = true;
      },
      resolve: resolveFn,
    };
    animations.push(anim);
    return anim as unknown as Animation;
  });
  (Element.prototype as unknown as { animate: typeof animate }).animate = animate;
  return { animations, animate };
}

function installMatchMedia(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('coarse') ? coarse : false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function mountTarget() {
  const root = document.createElement('div');
  root.id = 'onboarding-logbook-card';
  const content = document.createElement('div');
  content.setAttribute('data-swipe-content', '');
  const action = document.createElement('div');
  action.setAttribute('data-swipe-right-action', '');
  const icon = document.createElement('span');
  action.appendChild(icon);
  root.appendChild(content);
  root.appendChild(action);
  document.body.appendChild(root);
  return { root, content, action };
}

beforeEach(() => {
  getPreferenceMock.mockReset();
  setPreferenceMock.mockReset();
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LogbookSwipeHintOrchestrator', () => {
  it('skips animation and preference write when hint already seen', async () => {
    getPreferenceMock.mockResolvedValue(true);
    installMatchMedia(true);
    const { animate } = installFakeAnimations();
    mountTarget();

    render(<LogbookSwipeHintOrchestrator />);
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(animate).not.toHaveBeenCalled();
    expect(setPreferenceMock).not.toHaveBeenCalled();
  });

  it('skips animation on non-coarse pointer devices (desktop)', async () => {
    getPreferenceMock.mockResolvedValue(null);
    installMatchMedia(false);
    const { animate } = installFakeAnimations();
    mountTarget();

    render(<LogbookSwipeHintOrchestrator />);
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(animate).not.toHaveBeenCalled();
    expect(setPreferenceMock).not.toHaveBeenCalled();
  });

  it('does nothing and does not mark seen when target element is missing', async () => {
    getPreferenceMock.mockResolvedValue(null);
    installMatchMedia(true);
    const { animate } = installFakeAnimations();
    // no mountTarget() — the card is not on screen

    render(<LogbookSwipeHintOrchestrator />);
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(animate).not.toHaveBeenCalled();
    expect(setPreferenceMock).not.toHaveBeenCalled();
  });

  it('runs the animation sequence twice and marks the hint seen on completion', async () => {
    getPreferenceMock.mockResolvedValue(null);
    installMatchMedia(true);
    const { animations, animate } = installFakeAnimations();
    mountTarget();

    render(<LogbookSwipeHintOrchestrator />);

    // Flush the initial pref read + setTimeout trigger + first pair of animate() calls.
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(animate).toHaveBeenCalledTimes(2);

    // Drive every animation to completion; advance holds/gaps between them.
    for (let i = 0; i < 12; i++) {
      if (animations[i]) {
        animations[i].resolve();
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    // REPEAT_COUNT=2 cycles × (slideOut + fadeIn + slideBack + fadeOut) = 8 animate calls
    expect(animate).toHaveBeenCalledTimes(8);
    expect(setPreferenceMock).toHaveBeenCalledWith('swipeHint:logbookSeen', true);
  });

  it('cancels in-flight animations and does not mark seen when unmounted early', async () => {
    getPreferenceMock.mockResolvedValue(null);
    installMatchMedia(true);
    const { animations } = installFakeAnimations();
    mountTarget();

    const view = render(<LogbookSwipeHintOrchestrator />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(animations.length).toBeGreaterThan(0);

    view.unmount();

    expect(animations[0].cancelled).toBe(true);
    expect(setPreferenceMock).not.toHaveBeenCalled();
  });
});

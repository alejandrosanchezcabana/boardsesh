// @vitest-environment jsdom
/* eslint-disable import/first -- vi.hoisted mocks must appear before imports they mock. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// --- Module mocks ----------------------------------------------------------

type TourState = {
  active: boolean;
  currentStepId: string | null;
  stepIndex: number;
  totalSteps: number;
  next: () => void;
  skip: () => void;
};

const { mockUsePathname, mockUseOnboardingTour, tourState } = vi.hoisted(() => {
  const state: TourState = {
    active: false,
    currentStepId: null,
    stepIndex: 0,
    totalSteps: 12,
    next: vi.fn(),
    skip: vi.fn(),
  };
  return {
    mockUsePathname: vi.fn<() => string>(() => '/'),
    mockUseOnboardingTour: vi.fn<() => TourState>(() => state),
    tourState: state,
  };
});

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('../onboarding-tour-provider', () => ({
  useOnboardingTour: mockUseOnboardingTour,
}));

// Stub out MUI Popper so it renders its children directly in the DOM without
// needing a real DOM layout engine (jsdom doesn't run Popper.js correctly).
vi.mock('@mui/material/Popper', () => ({
  default: ({ children, open }: { children: React.ReactNode; open?: boolean; anchorEl?: unknown }) =>
    open ? <div data-testid="mui-popper">{children}</div> : null,
}));

import OnboardingTourOverlay from '../onboarding-tour-overlay';
/* eslint-enable import/first */

// --- Helpers ---------------------------------------------------------------

function setTourState(patch: Partial<TourState>) {
  Object.assign(tourState, patch);
}

function buildClimbCard(id = 'onboarding-climb-card') {
  const el = document.createElement('div');
  el.id = id;
  // Give it a non-zero bounding box so rect-based rendering works.
  el.style.width = '200px';
  el.style.height = '100px';
  document.body.appendChild(el);
  el.getBoundingClientRect = () =>
    ({
      top: 10,
      left: 10,
      right: 210,
      bottom: 110,
      width: 200,
      height: 100,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    }) as DOMRect;
  // jsdom doesn't implement scrollIntoView.
  (el as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  // Reset state
  tourState.active = false;
  tourState.currentStepId = null;
  tourState.stepIndex = 0;
  tourState.totalSteps = 12;
  tourState.next = vi.fn();
  tourState.skip = vi.fn();
  mockUsePathname.mockReturnValue('/');
  // jsdom lacks ResizeObserver; provide a no-op stub.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // useAnchorRect wraps its rect read in requestAnimationFrame. jsdom's rAF
  // usually works but pair with fake timers it may not fire — stub it to run
  // the callback synchronously in tests.
  (globalThis as unknown as { requestAnimationFrame: (cb: () => void) => number }).requestAnimationFrame = (
    cb: () => void,
  ) => {
    cb();
    return 0;
  };
  (globalThis as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = () => {};
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests -----------------------------------------------------------------

describe('OnboardingTourOverlay — gating', () => {
  it('renders nothing when the tour is inactive', () => {
    setTourState({ active: false, currentStepId: null });
    const { container } = render(<OnboardingTourOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the active step does not match the current route', () => {
    setTourState({ active: true, currentStepId: 'climb-list', stepIndex: 2 });
    mockUsePathname.mockReturnValue('/'); // not a board-list route
    const { container } = render(<OnboardingTourOverlay />);
    expect(container.innerHTML).toBe('');
  });
});

describe('OnboardingTourOverlay — intro layout', () => {
  it('renders the centred intro paper + scrim for home-intro', () => {
    setTourState({ active: true, currentStepId: 'home-intro', stepIndex: 0 });
    mockUsePathname.mockReturnValue('/');
    render(<OnboardingTourOverlay />);

    expect(screen.getByText(/Let's get you climbing/i)).toBeDefined();
    // Progress label
    expect(screen.getByText('1 of 12')).toBeDefined();
  });

  it('fires start-tour copy and exposes the primary button', () => {
    setTourState({ active: true, currentStepId: 'home-intro', stepIndex: 0 });
    mockUsePathname.mockReturnValue('/');
    render(<OnboardingTourOverlay />);

    const primary = screen.getByRole('button', { name: /Start the tour/i });
    fireEvent.click(primary);
    expect(tourState.next).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingTourOverlay — banner layout', () => {
  it('renders a top banner for non-intro steps that have no anchor', () => {
    setTourState({ active: true, currentStepId: 'home-pick-board', stepIndex: 1 });
    mockUsePathname.mockReturnValue('/');
    render(<OnboardingTourOverlay />);
    expect(screen.getByText(/Pick a board to start your sesh/i)).toBeDefined();
  });

  it('skip button calls skip()', () => {
    setTourState({ active: true, currentStepId: 'home-pick-board', stepIndex: 1 });
    mockUsePathname.mockReturnValue('/');
    render(<OnboardingTourOverlay />);

    fireEvent.click(screen.getByText(/Skip tour/i));
    expect(tourState.skip).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingTourOverlay — anchored layout', () => {
  it('renders the Popper + cutout when the anchor element is already in the DOM', async () => {
    buildClimbCard('onboarding-climb-card-2');
    buildClimbCard('onboarding-climb-card');
    setTourState({ active: true, currentStepId: 'climb-list', stepIndex: 2 });
    mockUsePathname.mockReturnValue('/kilter/10/5/1,2/40/list');

    render(<OnboardingTourOverlay />);
    // The anchor resolves in a useEffect + rect useEffect, so wait for the
    // Popper-rendered variant to appear.
    const popper = await screen.findByTestId('mui-popper');
    expect(popper).toBeDefined();
    expect(screen.getByText(/Your wall, your climbs/i)).toBeDefined();
  });

  it('falls back to the banner when the anchor is missing after the poll window', async () => {
    vi.useFakeTimers();
    // No climb cards in the DOM — the poll should time out.
    setTourState({ active: true, currentStepId: 'climb-list', stepIndex: 2 });
    mockUsePathname.mockReturnValue('/kilter/10/5/1,2/40/list');

    render(<OnboardingTourOverlay />);

    // Immediately after mount, with no anchor, the banner fallback is used
    // (non-intro step + null anchor).
    expect(screen.getByText(/Your wall, your climbs/i)).toBeDefined();

    // Run the poll to exhaustion and make sure the overlay stays intact.
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText(/Your wall, your climbs/i)).toBeDefined();
  });

  it('resolves the anchor once it mounts async (polling)', async () => {
    vi.useFakeTimers();
    setTourState({ active: true, currentStepId: 'climb-list', stepIndex: 2 });
    mockUsePathname.mockReturnValue('/kilter/10/5/1,2/40/list');

    render(<OnboardingTourOverlay />);
    expect(screen.queryByTestId('mui-popper')).toBeNull();

    // Mount the anchor late, then drive the poll past its next tick. Each
    // `act` flushes effects, so the poll → setEl → useAnchorRect → Popper
    // chain settles before we assert.
    buildClimbCard('onboarding-climb-card-2');
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('mui-popper')).toBeDefined();
  });
});

describe('OnboardingTourOverlay — primary button omission', () => {
  it('does not render a primary button when the step has no primaryLabel', () => {
    // home-pick-board has primaryLabel = null.
    setTourState({ active: true, currentStepId: 'home-pick-board', stepIndex: 1 });
    mockUsePathname.mockReturnValue('/');
    render(<OnboardingTourOverlay />);

    // No "Next" / primary button rendered; only the skip link.
    expect(screen.queryByRole('button', { name: /^Next$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Finish$/i })).toBeNull();
    expect(screen.getByText(/Skip tour/i)).toBeDefined();
  });
});

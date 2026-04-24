// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, act, screen } from '@testing-library/react';
import React from 'react';
import OnboardingDummySeshMount from '../onboarding-dummy-sesh-mount';
import { TOUR_CLOSE_DUMMY_SESH_EVENT, TOUR_OPEN_DUMMY_SESH_EVENT } from '../onboarding-tour-events';

const { mockSeshSettingsDrawer, mockGetMockSessionDetail, mockUseOnboardingTourOptional } = vi.hoisted(() => ({
  mockSeshSettingsDrawer: vi.fn<(props: Record<string, unknown>) => React.ReactElement | null>((props) =>
    props.open ? (
      <div
        data-testid="mock-sesh-drawer"
        data-active-section={(props.tourActiveSection as string | null) ?? ''}
        data-has-mock={props.tourMockSession ? 'true' : 'false'}
      />
    ) : null,
  ),
  mockGetMockSessionDetail: vi.fn(() => ({ sessionId: 'tour-mock-session' })),
  mockUseOnboardingTourOptional: vi.fn<() => { currentStepId: string | null } | null>(() => null),
}));

// next/dynamic's mock must return a component that renders the real default
// export — our mock replaces the whole module instead.
vi.mock('next/dynamic', () => ({
  default: () => mockSeshSettingsDrawer,
}));

vi.mock('@/app/components/sesh-settings/sesh-settings-drawer', () => ({
  default: mockSeshSettingsDrawer,
}));

vi.mock('../onboarding-tour-provider', () => ({
  useOnboardingTourOptional: mockUseOnboardingTourOptional,
}));

vi.mock('../mock-session-detail', () => ({
  getMockSessionDetail: mockGetMockSessionDetail,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOnboardingTourOptional.mockReturnValue(null);
  mockSeshSettingsDrawer.mockClear();
});

function dispatch(type: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent(type));
  });
}

describe('OnboardingDummySeshMount', () => {
  it('renders nothing until the tour fires open event', () => {
    render(<OnboardingDummySeshMount />);
    expect(screen.queryByTestId('mock-sesh-drawer')).toBeNull();
  });

  it('mounts the drawer with mock session when open event fires', () => {
    render(<OnboardingDummySeshMount />);
    dispatch(TOUR_OPEN_DUMMY_SESH_EVENT);
    const drawer = screen.getByTestId('mock-sesh-drawer');
    expect(drawer.getAttribute('data-has-mock')).toBe('true');
  });

  it('closes the drawer on close event but keeps it mounted for re-open', () => {
    render(<OnboardingDummySeshMount />);
    dispatch(TOUR_OPEN_DUMMY_SESH_EVENT);
    expect(screen.getByTestId('mock-sesh-drawer')).toBeDefined();

    dispatch(TOUR_CLOSE_DUMMY_SESH_EVENT);
    expect(screen.queryByTestId('mock-sesh-drawer')).toBeNull();

    dispatch(TOUR_OPEN_DUMMY_SESH_EVENT);
    expect(screen.getByTestId('mock-sesh-drawer')).toBeDefined();
  });

  it('derives tourActiveSection from the current tour step', () => {
    mockUseOnboardingTourOptional.mockReturnValue({ currentStepId: 'sesh-invite' });
    const { rerender } = render(<OnboardingDummySeshMount />);
    dispatch(TOUR_OPEN_DUMMY_SESH_EVENT);
    expect(screen.getByTestId('mock-sesh-drawer').getAttribute('data-active-section')).toBe('invite');

    mockUseOnboardingTourOptional.mockReturnValue({ currentStepId: 'sesh-activity' });
    rerender(<OnboardingDummySeshMount />);
    expect(screen.getByTestId('mock-sesh-drawer').getAttribute('data-active-section')).toBe('activity');

    mockUseOnboardingTourOptional.mockReturnValue({ currentStepId: 'sesh-analytics' });
    rerender(<OnboardingDummySeshMount />);
    expect(screen.getByTestId('mock-sesh-drawer').getAttribute('data-active-section')).toBe('analytics');
  });

  it('passes null activeSection when tour is on an unrelated step', () => {
    mockUseOnboardingTourOptional.mockReturnValue({ currentStepId: 'home-intro' });
    render(<OnboardingDummySeshMount />);
    dispatch(TOUR_OPEN_DUMMY_SESH_EVENT);
    expect(screen.getByTestId('mock-sesh-drawer').getAttribute('data-active-section')).toBe('');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// --- Mocks (before component imports) ---

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ status: 'authenticated', data: { user: { id: 'user-1' } } })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/you'),
}));

vi.mock('@/app/profile/[user_id]/hooks/use-profile-data', () => ({
  useProfileData: vi.fn(),
}));

vi.mock('@/app/profile/[user_id]/components/stats-summary', () => ({
  default: () => <div data-testid="stats-summary" />,
}));

vi.mock('@/app/profile/[user_id]/components/board-stats-section', () => ({
  default: () => <div data-testid="board-stats-section" />,
}));

vi.mock('@/app/components/activity-feed/activity-feed', () => ({
  default: (props: { userId?: string; isAuthenticated?: boolean }) => (
    <div data-testid="activity-feed" data-user-id={props.userId} />
  ),
}));

vi.mock('@/app/components/library/logbook-feed', () => ({
  default: () => <div data-testid="logbook-feed" />,
}));

// --- Imports after mocks ---

import YouPageContent from '../you-page-content';
import { useProfileData } from '@/app/profile/[user_id]/hooks/use-profile-data';
import { usePathname } from 'next/navigation';

const mockUseProfileData = vi.mocked(useProfileData);
const mockUsePathname = vi.mocked(usePathname);

// --- Helpers ---

function mockProfileDataReturn(overrides?: Partial<ReturnType<typeof useProfileData>>) {
  return {
    loading: false,
    notFound: false,
    profile: null,
    setProfile: vi.fn(),
    isOwnProfile: true,
    selectedBoard: 'kilter',
    setSelectedBoard: vi.fn(),
    loadingStats: false,
    filteredLogbook: [],
    timeframe: 'all' as const,
    setTimeframe: vi.fn(),
    fromDate: '',
    setFromDate: vi.fn(),
    toDate: '',
    setToDate: vi.fn(),
    weeklyBars: null,
    aggregatedFlashRedpointBars: null,
    vPointsTimeline: null,
    weeklyFromDate: '',
    setWeeklyFromDate: vi.fn(),
    weeklyToDate: '',
    setWeeklyToDate: vi.fn(),
    aggregatedTimeframe: 'all' as const,
    setAggregatedTimeframe: vi.fn(),
    loadingAggregated: false,
    aggregatedStackedBars: null,
    loadingProfileStats: false,
    statisticsSummary: { totalAscents: 0, layoutPercentages: [] },
    hardestSend: null,
    hardestFlash: null,
    ...overrides,
  };
}

describe('YouPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/you');
    mockUseProfileData.mockReturnValue(mockProfileDataReturn());
  });

  it('shows loading spinner when loading is true', () => {
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ loading: true }));

    render(<YouPageContent userId="user-1" />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('stats-summary')).toBeNull();
  });

  it('has three tabs: Progress, Sessions, Logbook', () => {
    render(<YouPageContent userId="user-1" />);

    expect(screen.getByRole('tab', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Logbook' })).toBeTruthy();
  });

  it('renders Progress tab content on /you path', () => {
    mockUsePathname.mockReturnValue('/you');

    render(<YouPageContent userId="user-1" />);

    expect(screen.getByRole('tab', { name: 'Progress', selected: true })).toBeTruthy();
    expect(screen.getByTestId('stats-summary')).toBeTruthy();
    expect(screen.getByTestId('board-stats-section')).toBeTruthy();
    expect(screen.queryByTestId('activity-feed')).toBeNull();
    expect(screen.queryByTestId('logbook-feed')).toBeNull();
  });

  it('renders Sessions tab content on /you/sessions path', () => {
    mockUsePathname.mockReturnValue('/you/sessions');

    render(<YouPageContent userId="user-1" />);

    expect(screen.getByRole('tab', { name: 'Sessions', selected: true })).toBeTruthy();
    expect(screen.getByTestId('activity-feed')).toBeTruthy();
    expect(screen.queryByTestId('stats-summary')).toBeNull();
    expect(screen.queryByTestId('logbook-feed')).toBeNull();
  });

  it('renders Logbook tab content on /you/logbook path', () => {
    mockUsePathname.mockReturnValue('/you/logbook');

    render(<YouPageContent userId="user-1" />);

    expect(screen.getByRole('tab', { name: 'Logbook', selected: true })).toBeTruthy();
    expect(screen.getByTestId('logbook-feed')).toBeTruthy();
    expect(screen.queryByTestId('stats-summary')).toBeNull();
    expect(screen.queryByTestId('activity-feed')).toBeNull();
  });

  it('activity feed receives userId prop', () => {
    mockUsePathname.mockReturnValue('/you/sessions');

    render(<YouPageContent userId="user-1" />);

    const feed = screen.getByTestId('activity-feed');
    expect(feed.getAttribute('data-user-id')).toBe('user-1');
  });
});

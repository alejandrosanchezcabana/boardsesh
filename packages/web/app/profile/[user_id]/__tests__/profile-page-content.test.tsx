import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// --- Mocks (before component imports) ---

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ status: 'authenticated', data: { user: { id: 'user-1' } } })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('../hooks/use-profile-data', () => ({
  useProfileData: vi.fn(),
}));

const mockBuildWeeklyBars = vi.fn(() => [] as Array<{ label: string; segments: Array<{ value: number; color: string; label: string }> }>);
vi.mock('../utils/chart-data-builders', () => ({
  buildWeeklyBars: (...args: unknown[]) => mockBuildWeeklyBars(...args),
}));

vi.mock('../components/user-card', () => ({
  default: (props: { userId: string }) => (
    <div data-testid="user-card" data-user-id={props.userId} />
  ),
}));

vi.mock('../components/profile-nav-card', () => ({
  default: (props: { title: string; href: string }) => (
    <div data-testid={`nav-card-${props.title.toLowerCase().replace(/\s+/g, '-')}`} data-href={props.href}>
      {props.title}
    </div>
  ),
}));

vi.mock('@/app/components/charts/css-bar-chart', () => ({
  CssBarChart: () => <div data-testid="overview-chart" />,
}));

vi.mock('@/app/hooks/use-grade-format', () => ({
  useGradeFormat: () => ({ gradeFormat: 'vscale', loaded: true }),
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: vi.fn() }),
}));

vi.mock('@/app/components/ui/empty-state', () => ({
  EmptyState: (props: { description: string }) => (
    <div data-testid="empty-state">{props.description}</div>
  ),
}));

vi.mock('@/app/components/back-button', () => ({
  default: () => <div data-testid="back-button" />,
}));

vi.mock('@/app/components/brand/logo', () => ({
  default: () => <div data-testid="logo" />,
}));

vi.mock('@/app/lib/share-utils', () => ({
  shareWithFallback: vi.fn(),
}));

// --- Imports after mocks ---

import ProfilePageContent from '../profile-page-content';
import { useProfileData } from '../hooks/use-profile-data';

const mockUseProfileData = vi.mocked(useProfileData);

// --- Helpers ---

function mockProfileDataReturn(overrides?: Partial<ReturnType<typeof useProfileData>>) {
  return {
    loading: false,
    notFound: false,
    profile: null,
    setProfile: vi.fn(),
    isOwnProfile: false,
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
    ...overrides,
  };
}

function makeProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'user-2',
    email: 'climber@example.com',
    name: 'Test Climber',
    image: null,
    profile: { displayName: 'Test Climber', bio: 'I climb things' },
    credentials: [],
    followerCount: 5,
    followingCount: 3,
    isFollowedByMe: false,
    ...overrides,
  };
}

describe('ProfilePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn());
  });

  it('shows loading spinner when loading is true', () => {
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ loading: true }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('user-card')).toBeNull();
  });

  it('shows "User not found" empty state when notFound is true', () => {
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ notFound: true }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('User not found')).toBeTruthy();
  });

  it('renders user card with userId when profile exists', () => {
    const profile = makeProfile();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    const userCard = screen.getByTestId('user-card');
    expect(userCard).toBeTruthy();
    expect(userCard.getAttribute('data-user-id')).toBe('user-2');
  });

  it('renders Sessions and Analytics navigation cards', () => {
    const profile = makeProfile();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByTestId('nav-card-sessions')).toBeTruthy();
    expect(screen.getByTestId('nav-card-analytics')).toBeTruthy();
  });

  it('shows "Their Climbs" nav card when user has credentials', () => {
    const profile = makeProfile({
      credentials: [{ id: 'cred-1', boardType: 'kilter' }],
    });
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByTestId('nav-card-their-climbs')).toBeTruthy();
  });

  it('hides "Their Climbs" nav card when user has no credentials', () => {
    const profile = makeProfile({ credentials: [] });
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.queryByTestId('nav-card-their-climbs')).toBeNull();
  });

  it('nav cards link to correct sub-pages', () => {
    const profile = makeProfile({
      credentials: [{ id: 'cred-1', boardType: 'kilter' }],
    });
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByTestId('nav-card-sessions').getAttribute('data-href')).toBe('/profile/user-2/sessions');
    expect(screen.getByTestId('nav-card-analytics').getAttribute('data-href')).toBe('/profile/user-2/analytics');
    expect(screen.getByTestId('nav-card-their-climbs').getAttribute('data-href')).toBe('/profile/user-2/climbs');
  });

  it('renders overview chart when tick data is available', () => {
    const profile = makeProfile();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    mockBuildWeeklyBars.mockReturnValue([{ label: 'W1', segments: [{ value: 3, color: '#ccc', label: 'V3' }] }]);

    const allBoardsTicks = {
      kilter: [
        { climbed_at: new Date().toISOString(), difficulty: 15, tries: 1, angle: 40, status: 1, climbUuid: 'c1' },
      ],
    };

    render(<ProfilePageContent userId="user-2" initialAllBoardsTicks={allBoardsTicks} />);

    expect(screen.getByTestId('overview-chart')).toBeTruthy();
  });

  it('shows share button when profile exists', () => {
    const profile = makeProfile();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByLabelText('Share profile')).toBeTruthy();
  });

  it('shows "Profile" as header title', () => {
    const profile = makeProfile();
    mockUseProfileData.mockReturnValue(mockProfileDataReturn({ profile }));

    render(<ProfilePageContent userId="user-2" />);

    expect(screen.getByText('Profile')).toBeTruthy();
  });
});

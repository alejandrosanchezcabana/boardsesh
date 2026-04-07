// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';
import type { UseGeolocationReturn } from '@/app/hooks/use-geolocation';

// --- Mocks ---

const mockRequestPermission = vi.fn();

const mockGeolocation: UseGeolocationReturn = {
  coordinates: null,
  error: null,
  loading: false,
  permissionState: null,
  requestPermission: mockRequestPermission,
  refresh: vi.fn(),
};

vi.mock('@/app/hooks/use-geolocation', () => ({
  useGeolocation: () => mockGeolocation,
}));

const mockNearbyBoards: {
  boards: UserBoard[];
  isLoading: boolean;
  permissionState: PermissionState | null;
  requestPermission: ReturnType<typeof vi.fn>;
  error: string | null;
} = {
  boards: [],
  isLoading: false,
  permissionState: null,
  requestPermission: mockRequestPermission,
  error: null,
};

vi.mock('@/app/hooks/use-nearby-boards', () => ({
  useNearbyBoards: () => mockNearbyBoards,
}));

// Mock leaflet dynamic import so jsdom doesn't attempt to load it
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    flyTo: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  marker: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
  })),
  divIcon: vi.fn(),
  layerGroup: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
  })),
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

import BoardMapView from '../board-map-view';

function makeBoard(overrides: Partial<UserBoard> = {}): UserBoard {
  return {
    uuid: 'board-1',
    slug: 'test-board',
    ownerId: 'owner-1',
    boardType: 'kilter',
    layoutId: 1,
    sizeId: 10,
    setIds: '1,2',
    name: 'Test Board',
    latitude: 40.7128,
    longitude: -74.006,
    isPublic: true,
    isUnlisted: false,
    hideLocation: false,
    isOwned: false,
    angle: 40,
    isAngleAdjustable: false,
    createdAt: '2024-01-01T00:00:00Z',
    totalAscents: 100,
    uniqueClimbers: 50,
    followerCount: 25,
    commentCount: 10,
    isFollowedByMe: false,
    distanceMeters: 1500,
    ...overrides,
  };
}

describe('BoardMapView', () => {
  beforeEach(() => {
    // Reset mock state to defaults
    mockGeolocation.coordinates = null;
    mockGeolocation.error = null;
    mockGeolocation.loading = false;
    mockGeolocation.permissionState = null;

    mockNearbyBoards.boards = [];
    mockNearbyBoards.isLoading = false;
    mockNearbyBoards.permissionState = null;
    mockNearbyBoards.error = null;

    vi.clearAllMocks();
  });

  it('renders location permission prompt when coordinates are not available and permission is not granted', () => {
    mockNearbyBoards.permissionState = null;
    mockGeolocation.permissionState = null;

    const onBoardSelect = vi.fn();
    render(<BoardMapView onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Enable location access to see boards on the map')).toBeTruthy();
    expect(screen.getByText('Enable Location')).toBeTruthy();
  });

  it('renders denied message when permission is denied and no coordinates', () => {
    mockNearbyBoards.permissionState = 'denied';
    mockGeolocation.permissionState = 'denied';
    mockGeolocation.coordinates = null;

    const onBoardSelect = vi.fn();
    render(<BoardMapView onBoardSelect={onBoardSelect} />);

    expect(
      screen.getByText(
        'Location access was denied. Tap below to try again, or enable location in your browser settings.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Enable Location')).toBeTruthy();
  });

  it('calls requestPermission when Enable Location button is clicked', () => {
    mockNearbyBoards.permissionState = 'prompt';
    mockGeolocation.permissionState = 'prompt';
    mockGeolocation.coordinates = null;

    const onBoardSelect = vi.fn();
    render(<BoardMapView onBoardSelect={onBoardSelect} />);

    fireEvent.click(screen.getByText('Enable Location'));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('renders loading spinner when loading with no boards', () => {
    mockNearbyBoards.isLoading = true;
    mockNearbyBoards.permissionState = 'granted';
    mockNearbyBoards.boards = [];
    mockGeolocation.coordinates = { latitude: 40, longitude: -74, accuracy: 10 };
    mockGeolocation.permissionState = 'granted';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('does not show loading spinner when loading but boards already exist', () => {
    mockNearbyBoards.isLoading = true;
    mockNearbyBoards.permissionState = 'granted';
    mockNearbyBoards.boards = [makeBoard()];
    mockGeolocation.coordinates = { latitude: 40, longitude: -74, accuracy: 10 };
    mockGeolocation.permissionState = 'granted';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    // Should not show the loading spinner since boards.length > 0
    const spinnerBox = container.querySelector('[role="progressbar"]');
    // The component checks `isLoading && boards.length === 0`, so with boards present
    // it should render the map container instead
    expect(spinnerBox).toBeNull();
  });

  it('renders map container when boards and coordinates are available', () => {
    mockNearbyBoards.isLoading = false;
    mockNearbyBoards.permissionState = 'granted';
    mockNearbyBoards.boards = [makeBoard()];
    mockGeolocation.coordinates = { latitude: 40.7128, longitude: -74.006, accuracy: 10 };
    mockGeolocation.permissionState = 'granted';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    // Should not show the permission prompt or loading spinner
    expect(screen.queryByText('Enable Location')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();

    // The outer Box wrapper should be rendered (the map container)
    // It has minHeight: 300 and uses calc for height
    const outerBox = container.firstChild as HTMLElement;
    expect(outerBox).not.toBeNull();
  });

  it('renders map container when permission is granted but no boards yet (not loading)', () => {
    mockNearbyBoards.isLoading = false;
    mockNearbyBoards.permissionState = 'granted';
    mockNearbyBoards.boards = [];
    mockGeolocation.coordinates = { latitude: 40.7128, longitude: -74.006, accuracy: 10 };
    mockGeolocation.permissionState = 'granted';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    // Should not show permission prompt or loading spinner
    expect(screen.queryByText('Enable Location')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();

    // Map container should be present
    expect(container.firstChild).not.toBeNull();
  });

  it('does not render permission prompt when coordinates are available even if permissionState is not granted', () => {
    // Edge case: coordinates exist but permissionState hasn't updated
    mockNearbyBoards.permissionState = 'prompt';
    mockNearbyBoards.boards = [];
    mockNearbyBoards.isLoading = true;
    mockGeolocation.coordinates = { latitude: 40, longitude: -74, accuracy: 10 };
    mockGeolocation.permissionState = 'prompt';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    // The condition is `!coordinates && permissionState !== 'granted'`
    // Since coordinates exist, the permission prompt should not show
    expect(screen.queryByText('Enable Location')).toBeNull();
    // Should show loading since isLoading=true and boards.length===0
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('shows permission prompt when permissionState is prompt and no coordinates', () => {
    mockNearbyBoards.permissionState = 'prompt';
    mockGeolocation.coordinates = null;
    mockGeolocation.permissionState = 'prompt';

    const onBoardSelect = vi.fn();
    render(<BoardMapView onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Enable location access to see boards on the map')).toBeTruthy();
  });

  it('does not show permission prompt when permissionState is granted even without coordinates', () => {
    mockNearbyBoards.permissionState = 'granted';
    mockNearbyBoards.isLoading = true;
    mockNearbyBoards.boards = [];
    mockGeolocation.coordinates = null;
    mockGeolocation.permissionState = 'granted';

    const onBoardSelect = vi.fn();
    const { container } = render(<BoardMapView onBoardSelect={onBoardSelect} />);

    // permissionState is 'granted', so the condition `!coordinates && permissionState !== 'granted'`
    // evaluates to false -- no permission prompt
    expect(screen.queryByText('Enable Location')).toBeNull();
    // Should show loading state instead
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });
});

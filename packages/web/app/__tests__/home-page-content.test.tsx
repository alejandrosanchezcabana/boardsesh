import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { ActiveSessionInfo } from '@/app/components/persistent-session/types';

// --- Mocks ---

const mockPush = vi.fn();
const mockSetClimbSessionCookie = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/app/lib/climb-session-cookie', () => ({
  setClimbSessionCookie: (...args: unknown[]) => mockSetClimbSessionCookie(...args),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

let mockActiveSession: ActiveSessionInfo | null = null;
vi.mock('@/app/components/persistent-session', () => ({
  usePersistentSession: () => ({ activeSession: mockActiveSession }),
  usePersistentSessionState: () => ({ activeSession: mockActiveSession }),
  usePersistentSessionActions: () => ({}),
}));

vi.mock('@/app/components/session-creation/start-sesh-drawer', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="start-sesh-drawer">Drawer</div> : null,
}));

vi.mock('@/app/components/search-drawer/unified-search-drawer', () => ({
  default: () => null,
}));

vi.mock('@/app/components/board-selector-drawer/board-selector-drawer', () => ({
  default: () => null,
}));

vi.mock('@/app/components/board-scroll/board-discovery-scroll', () => ({
  default: () => null,
}));

import HomePageContent from '../home-page-content';

// --- Helpers ---

function makeActiveSession(overrides: Partial<ActiveSessionInfo> = {}): ActiveSessionInfo {
  return {
    sessionId: 'session-123',
    boardPath: '/b/kilter-original-12x12/40/list',
    boardDetails: {} as ActiveSessionInfo['boardDetails'],
    parsedParams: {
      board_name: 'kilter',
      layout_id: 1,
      size_id: 10,
      set_ids: [1, 2],
      angle: 40,
    },
    ...overrides,
  };
}

const defaultProps = {
  boardConfigs: {} as React.ComponentProps<typeof HomePageContent>['boardConfigs'],
};

// --- Tests ---

describe('HomePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSession = null;
  });

  describe('hero button without active session', () => {
    it('shows "Start climbing" when no active session', () => {
      render(<HomePageContent {...defaultProps} />);
      expect(screen.getByRole('button', { name: /start climbing/i })).toBeTruthy();
    });

    it('opens the session creation drawer on click', async () => {
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /start climbing/i }));
      // Drawer mounts asynchronously via useEffect after state change
      await waitFor(() => {
        expect(screen.getByTestId('start-sesh-drawer')).toBeTruthy();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('hero button with active session', () => {
    it('shows "Continue climbing" when active session exists', () => {
      mockActiveSession = makeActiveSession();
      render(<HomePageContent {...defaultProps} />);
      expect(screen.getByRole('button', { name: /continue climbing/i })).toBeTruthy();
    });

    it('navigates to climb list for /b/ slug paths', () => {
      mockActiveSession = makeActiveSession({
        boardPath: '/b/kilter-original-12x12/40/list',
        parsedParams: {
          board_name: 'kilter',
          layout_id: 1,
          size_id: 10,
          set_ids: [1, 2],
          angle: 40,
        },
      });
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      expect(mockSetClimbSessionCookie).toHaveBeenCalledWith('session-123');
      expect(mockPush).toHaveBeenCalledWith('/b/kilter-original-12x12/40/list');
    });

    it('extracts slug correctly regardless of trailing path segments', () => {
      mockActiveSession = makeActiveSession({
        boardPath: '/b/tension-tb2-original/25/play/some-uuid',
        parsedParams: {
          board_name: 'tension',
          layout_id: 2,
          size_id: 5,
          set_ids: [3],
          angle: 25,
        },
      });
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      expect(mockSetClimbSessionCookie).toHaveBeenCalledWith('session-123');
      expect(mockPush).toHaveBeenCalledWith('/b/tension-tb2-original/25/list');
    });

    it('navigates directly to boardPath for legacy/custom paths', () => {
      mockActiveSession = makeActiveSession({
        boardPath: '/kilter/1/10/1,2/40',
      });
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      expect(mockSetClimbSessionCookie).toHaveBeenCalledWith('session-123');
      expect(mockPush).toHaveBeenCalledWith('/kilter/1/10/1,2/40');
    });

    it('does not open the session creation drawer when active session exists', () => {
      mockActiveSession = makeActiveSession();
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      expect(screen.queryByTestId('start-sesh-drawer')).toBeNull();
    });

    it('uses parsedParams.angle for the URL, not the angle in boardPath', () => {
      mockActiveSession = makeActiveSession({
        boardPath: '/b/my-board/40/list',
        parsedParams: {
          board_name: 'kilter',
          layout_id: 1,
          size_id: 10,
          set_ids: [1],
          angle: 45,
        },
      });
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      // Should use parsedParams.angle (45), not the 40 from boardPath
      expect(mockSetClimbSessionCookie).toHaveBeenCalledWith('session-123');
      expect(mockPush).toHaveBeenCalledWith('/b/my-board/45/list');
    });

    it('handles negative angles correctly', () => {
      mockActiveSession = makeActiveSession({
        boardPath: '/b/tension-board/-20/list',
        parsedParams: {
          board_name: 'tension',
          layout_id: 1,
          size_id: 10,
          set_ids: [1],
          angle: -20,
        },
      });
      render(<HomePageContent {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /continue climbing/i }));
      expect(mockSetClimbSessionCookie).toHaveBeenCalledWith('session-123');
      expect(mockPush).toHaveBeenCalledWith('/b/tension-board/-20/list');
    });
  });

  describe('SSR popular configs', () => {
    it('passes initialPopularConfigs to BoardDiscoveryScroll when provided', () => {
      // BoardDiscoveryScroll is mocked, so we just verify the component renders without error
      const initialConfigs = [
        {
          boardType: 'kilter',
          layoutId: 8,
          layoutName: 'Original',
          sizeId: 25,
          sizeName: '12x12',
          sizeDescription: 'Full size',
          setIds: [26, 27],
          setNames: ['Set A', 'Set B'],
          climbCount: 500,
          totalAscents: 5000,
          displayName: 'OG 12x12',
        },
      ];

      render(<HomePageContent {...defaultProps} initialPopularConfigs={initialConfigs} />);
      expect(screen.getByRole('button', { name: /start climbing/i })).toBeTruthy();
    });
  });
});

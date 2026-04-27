// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBuildClimbDetailSections } from '../build-climb-detail-sections';
import type { Climb } from '@/app/lib/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Mock child components to avoid pulling in their dependency trees
vi.mock('@/app/components/logbook/logbook-section', () => ({
  LogbookSection: () => null,
  useLogbookSummary: () => null,
}));
vi.mock('@/app/components/logbook/crew-logbook-view', () => ({
  CrewLogbookView: () => null,
}));
vi.mock('@/app/components/social/climb-social-section', () => ({
  default: () => null,
}));
vi.mock('@/app/components/charts/climb-analytics', () => ({
  default: () => null,
}));
vi.mock('@/app/components/beta-videos/boardsesh-beta-section', () => ({
  default: () => null,
}));
vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({
    request: async () => ({ betaLinks: [] }),
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MOCK_CLIMB = {
  uuid: 'test-climb-uuid',
  name: 'Test Climb',
  frames: 'p1r12',
  setter_username: 'tester',
  is_listed: true,
  is_draft: false,
  layout_id: 1,
  edge_left: 0,
  edge_right: 100,
  edge_bottom: 0,
  edge_top: 100,
  angle: 40,
  description: '',
  hsm: 0,
  difficulty: '5',
  quality_average: '3.0',
  stars: 3,
  stars_average: 3,
  difficulty_average: '5',
  difficulty_error: '0.00',
  benchmark_difficulty: null,
  ascensionist_count: 10,
  display_difficulty: 'V5',
  boulder_name: 'Test Climb',
  draft_difficulty: '5',
  repeat_count: 5,
  votes_count: 8,
  draft_difficulty_display: 'V5',
} as unknown as Climb;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const BASE_PROPS = {
  climb: MOCK_CLIMB,
  climbUuid: MOCK_CLIMB.uuid,
  boardType: 'kilter',
  angle: 40,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBuildClimbDetailSections', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 5 sections when enabled (default)', () => {
    const { result } = renderHook(() => useBuildClimbDetailSections(BASE_PROPS), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveLength(5);
    expect(result.current.map((s) => s.key)).toEqual(['beta', 'logbook', 'crew-logbook', 'community', 'analytics']);
  });

  it('returns empty array when enabled is false', () => {
    const { result } = renderHook(() => useBuildClimbDetailSections({ ...BASE_PROPS, enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([]);
  });

  it('returns sections again when enabled flips from false to true', () => {
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useBuildClimbDetailSections({ ...BASE_PROPS, enabled }),
      { wrapper, initialProps: { enabled: false } },
    );

    expect(result.current).toEqual([]);

    rerender({ enabled: true });

    expect(result.current).toHaveLength(5);
    expect(result.current.map((s) => s.key)).toEqual(['beta', 'logbook', 'crew-logbook', 'community', 'analytics']);
  });

  it('all sections are lazy', () => {
    const { result } = renderHook(() => useBuildClimbDetailSections(BASE_PROPS), {
      wrapper: createWrapper(),
    });

    for (const section of result.current) {
      expect(section.lazy).toBe(true);
    }
  });

  it('beta is the default-active section when no proposalUuid is set', () => {
    const { result } = renderHook(() => useBuildClimbDetailSections(BASE_PROPS), {
      wrapper: createWrapper(),
    });

    const beta = result.current.find((s) => s.key === 'beta');
    expect(beta?.defaultActive).toBe(true);
  });
});

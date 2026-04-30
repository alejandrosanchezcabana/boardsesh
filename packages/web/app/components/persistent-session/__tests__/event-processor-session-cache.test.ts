import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEventProcessor } from '../hooks/use-event-processor';
import type { ClimbQueueItem as LocalClimbQueueItem } from '../../queue-control/types';
import type { SessionEvent, SessionDetail, SessionDetailTick } from '@boardsesh/shared-schema';
import type { SubscriptionQueueEvent } from '@boardsesh/shared-schema';
import { SESSION_DETAIL_QUERY_KEY } from '@/app/hooks/use-session-detail';

function createRefs() {
  return {
    lastReceivedSequenceRef: { current: null as number | null },
    triggerResyncRef: { current: null as (() => void) | null },
    lastCorruptionResyncRef: { current: 0 },
    isFilteringCorruptedItemsRef: { current: false },
    queueEventSubscribersRef: { current: new Set<(event: SubscriptionQueueEvent) => void>() },
    sessionEventSubscribersRef: { current: new Set() } as never,
    offlineBufferRef: { current: [] as LocalClimbQueueItem[] },
  };
}

function createStatsEvent(overrides: Partial<Extract<SessionEvent, { __typename: 'SessionStatsUpdated' }>> = {}): SessionEvent {
  return {
    __typename: 'SessionStatsUpdated',
    sessionId: 'session-abc',
    totalSends: 3,
    totalFlashes: 1,
    totalAttempts: 2,
    tickCount: 5,
    participants: [],
    gradeDistribution: [],
    boardTypes: ['kilter'],
    hardestGrade: 'V5',
    durationMinutes: 45,
    goal: 'Send V5',
    ticks: [],
    ...overrides,
  };
}

function createTick(climbedAt: string): SessionDetailTick {
  return {
    uuid: `tick-${climbedAt}`,
    climbUuid: 'climb-1',
    climbName: 'Test Climb',
    angle: 40,
    status: 'send',
    attemptCount: 1,
    isMirror: false,
    isBenchmark: false,
    isNoMatch: false,
    climbedAt,
    boardType: 'kilter',
    userId: 'user-1',
    upvotes: 0,
  };
}

describe('useEventProcessor - SessionStatsUpdated → React Query cache', () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('seeds cache when no existing data', () => {
    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent(createStatsEvent());
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached).not.toBeNull();
    expect(cached!.totalSends).toBe(3);
    expect(cached!.totalFlashes).toBe(1);
    expect(cached!.totalAttempts).toBe(2);
    expect(cached!.tickCount).toBe(5);
    expect(cached!.boardTypes).toEqual(['kilter']);
    expect(cached!.hardestGrade).toBe('V5');
    expect(cached!.durationMinutes).toBe(45);
    expect(cached!.goal).toBe('Send V5');
  });

  it('defaults sessionType to party when seeding', () => {
    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent(createStatsEvent());
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached!.sessionType).toBe('party');
  });

  it('sets firstTickAt/lastTickAt to empty string when no ticks and no prev data', () => {
    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent(createStatsEvent({ ticks: [] }));
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached!.firstTickAt).toBe('');
    expect(cached!.lastTickAt).toBe('');
  });

  it('derives firstTickAt/lastTickAt from ticks when present', () => {
    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    const ticks = [
      createTick('2026-04-30T10:00:00Z'),
      createTick('2026-04-30T09:30:00Z'),
      createTick('2026-04-30T09:00:00Z'),
    ];

    act(() => {
      result.current.handleSessionEvent(createStatsEvent({ ticks }));
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached!.lastTickAt).toBe('2026-04-30T10:00:00Z');
    expect(cached!.firstTickAt).toBe('2026-04-30T09:00:00Z');
  });

  it('merges into existing cached data, preserving sessionType and ownerUserId', () => {
    const existingData: SessionDetail = {
      sessionId: 'session-abc',
      sessionType: 'inferred',
      sessionName: 'My Inferred Session',
      ownerUserId: 'owner-123',
      participants: [],
      totalSends: 1,
      totalFlashes: 0,
      totalAttempts: 1,
      tickCount: 1,
      gradeDistribution: [],
      boardTypes: ['kilter'],
      hardestGrade: 'V3',
      firstTickAt: '2026-04-30T08:00:00Z',
      lastTickAt: '2026-04-30T08:00:00Z',
      durationMinutes: 10,
      goal: null,
      ticks: [],
      upvotes: 5,
      downvotes: 1,
      voteScore: 4,
      commentCount: 3,
    };

    queryClient.setQueryData(SESSION_DETAIL_QUERY_KEY('session-abc'), existingData);

    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent(
        createStatsEvent({
          totalSends: 5,
          totalFlashes: 2,
          hardestGrade: 'V6',
          ticks: [createTick('2026-04-30T11:00:00Z')],
        }),
      );
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached!.sessionType).toBe('inferred');
    expect(cached!.ownerUserId).toBe('owner-123');
    expect(cached!.sessionName).toBe('My Inferred Session');
    expect(cached!.upvotes).toBe(5);
    expect(cached!.commentCount).toBe(3);
    expect(cached!.totalSends).toBe(5);
    expect(cached!.totalFlashes).toBe(2);
    expect(cached!.hardestGrade).toBe('V6');
  });

  it('preserves prev firstTickAt/lastTickAt when merging with no ticks', () => {
    const existingData: SessionDetail = {
      sessionId: 'session-abc',
      sessionType: 'party',
      sessionName: null,
      ownerUserId: null,
      participants: [],
      totalSends: 0,
      totalFlashes: 0,
      totalAttempts: 0,
      tickCount: 0,
      gradeDistribution: [],
      boardTypes: [],
      hardestGrade: null,
      firstTickAt: '2026-04-30T08:00:00Z',
      lastTickAt: '2026-04-30T09:00:00Z',
      durationMinutes: null,
      goal: null,
      ticks: [],
      upvotes: 0,
      downvotes: 0,
      voteScore: 0,
      commentCount: 0,
    };

    queryClient.setQueryData(SESSION_DETAIL_QUERY_KEY('session-abc'), existingData);

    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent(createStatsEvent({ ticks: [] }));
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached!.firstTickAt).toBe('2026-04-30T08:00:00Z');
    expect(cached!.lastTickAt).toBe('2026-04-30T09:00:00Z');
  });

  it('notifies session event subscribers', () => {
    const refs = createRefs();
    const subscriberCalls: SessionEvent[] = [];
    (refs.sessionEventSubscribersRef as { current: Set<(event: SessionEvent) => void> }).current.add((e) =>
      subscriberCalls.push(e),
    );

    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    const event = createStatsEvent();
    act(() => {
      result.current.handleSessionEvent(event);
    });

    expect(subscriberCalls).toHaveLength(1);
    expect(subscriberCalls[0]).toBe(event);
  });

  it('handles non-SessionStatsUpdated events without touching cache', () => {
    const refs = createRefs();
    const { result } = renderHook(() => useEventProcessor({ refs }), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSessionEvent({
        __typename: 'UserJoined',
        user: { id: 'user-1', username: 'test', isLeader: false },
      });
    });

    const cached = queryClient.getQueryData<SessionDetail>(SESSION_DETAIL_QUERY_KEY('session-abc'));
    expect(cached).toBeUndefined();
  });
});

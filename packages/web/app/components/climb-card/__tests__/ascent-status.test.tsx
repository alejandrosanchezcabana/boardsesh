import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/app/test-utils/test-providers';

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const mockRequest = vi.fn();
vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({ request: mockRequest }),
}));

vi.mock('@/app/lib/graphql/operations', () => ({
  GET_TICKS: 'GET_TICKS_QUERY',
}));

import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { useSession } from 'next-auth/react';
import { useLogbook, accumulatedLogbookQueryKey, type LogbookEntry } from '@/app/hooks/use-logbook';
import { AscentStatus } from '../ascent-status';
import { BoardContext, type BoardContextType } from '../../board-provider/board-provider-context';

const mockUseWsAuthToken = vi.mocked(useWsAuthToken);
const mockUseSession = vi.mocked(useSession);

function AscentStatusHarness() {
  const { logbook } = useLogbook('kilter', ['climb-1']);

  const contextValue: BoardContextType = {
    boardName: 'kilter',
    isAuthenticated: true,
    isLoading: false,
    error: null,
    isInitialized: true,
    logbook,
    getLogbook: async () => {},
    saveTick: async () => {},
    saveClimb: async () => {
      throw new Error('unused in test');
    },
    updateClimb: async () => {
      throw new Error('unused in test');
    },
  };

  return (
    <BoardContext.Provider value={contextValue}>
      <AscentStatus climbUuid="climb-1" />
    </BoardContext.Provider>
  );
}

describe('AscentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockReset();
    mockUseWsAuthToken.mockReturnValue({
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: { user: { id: '1' }, expires: '' },
      update: vi.fn(),
    });
  });

  it('renders the badge immediately from accumulated logbook cache updates without a refetch', async () => {
    mockRequest.mockResolvedValue({ ticks: [] });

    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AscentStatusHarness />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
    expect(container.querySelector('span')).toBeNull();

    const optimisticEntry: LogbookEntry = {
      uuid: 'temp-1',
      climb_uuid: 'climb-1',
      angle: 40,
      is_mirror: false,
      tries: 1,
      quality: null,
      difficulty: null,
      comment: '',
      climbed_at: '2024-02-01',
      is_ascent: true,
      status: 'flash',
    };

    act(() => {
      queryClient.setQueryData<LogbookEntry[]>(
        accumulatedLogbookQueryKey('kilter'),
        [optimisticEntry],
      );
    });

    await waitFor(() => {
      expect(container.querySelector('span')).not.toBeNull();
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});

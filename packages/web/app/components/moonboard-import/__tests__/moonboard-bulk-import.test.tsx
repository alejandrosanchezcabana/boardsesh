import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockShowMessage = vi.fn();
const mockRequest = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => '/b/moonboard-2016-40/import',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } } }),
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

vi.mock('@boardsesh/moonboard-ocr/browser', () => ({
  parseMultipleScreenshots: vi.fn(async () => ({
    climbs: [
      {
        sourceFile: 'screen-1.png',
        name: 'Imported Climb',
        setter: 'Setter',
        userGrade: '6A+',
        isBenchmark: false,
        angle: 40,
        holds: {
          start: ['A1'],
          hand: ['B2'],
          finish: ['C3'],
        },
      },
    ],
    errors: [],
  })),
  deduplicateClimbs: (climbs: unknown[]) => climbs,
}));

vi.mock('../moonboard-import-card', () => ({
  default: ({ climb, duplicateMatch }: { climb: { name: string }; duplicateMatch: { exists?: boolean; existingClimbName?: string | null } | null }) => (
    <div>
      <div>{climb.name}</div>
      {duplicateMatch?.exists && <div>{`Already exists as "${duplicateMatch.existingClimbName}"`}</div>}
    </div>
  ),
}));

vi.mock('../moonboard-edit-modal', () => ({
  default: () => null,
}));

vi.mock('@/app/components/connection-manager/connection-settings-context', () => ({
  useBackendUrl: () => ({ backendUrl: null }),
}));

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => ({ token: 'auth-token' }),
}));

vi.mock('@/app/lib/moonboard-ocr-upload', () => ({
  uploadOcrTestDataBatch: vi.fn(),
}));

vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({ request: mockRequest }),
}));

vi.mock('@/app/lib/climb-search-cache', () => ({
  refreshClimbSearchAfterSave: vi.fn(),
}));

import MoonBoardBulkImport from '../moonboard-bulk-import';

function renderComponent() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MoonBoardBulkImport
        layoutFolder="moonboard2016"
        layoutName="MoonBoard 2016"
        layoutId={2}
        holdSetImages={['holdseta.png']}
        angle={40}
      />
    </QueryClientProvider>,
  );
}

describe('MoonBoardBulkImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({
      checkMoonBoardClimbDuplicates: [
        {
          clientKey: 'screen-1.png',
          exists: true,
          existingClimbUuid: 'existing-1',
          existingClimbName: 'Existing Problem',
        },
      ],
    });
  });

  it('warns about duplicates before save and excludes them from Save All', async () => {
    const { container } = renderComponent();

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    fireEvent.change(input!, {
      target: {
        files: [new File(['dummy'], 'screen-1.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('1 Duplicate Climb(s)')).toBeTruthy();
    });

    expect(screen.getAllByText(/Already exists as "Existing Problem"/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Save All (0)' }).hasAttribute('disabled')).toBe(true);
  });
});

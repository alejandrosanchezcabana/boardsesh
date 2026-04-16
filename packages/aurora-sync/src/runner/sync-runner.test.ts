import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuroraRequestError } from '../api/errors';

const { mockDecrypt, mockEncrypt, mockSignIn } = vi.hoisted(() => ({
  mockDecrypt: vi.fn(),
  mockEncrypt: vi.fn(),
  mockSignIn: vi.fn(),
}));

vi.mock('@boardsesh/crypto', () => ({
  decrypt: mockDecrypt,
  encrypt: mockEncrypt,
}));

vi.mock('../sync/user-sync', () => ({
  syncUserData: vi.fn(),
}));

vi.mock('../api/aurora-client', () => ({
  AuroraClimbingClient: class MockAuroraClimbingClient {
    signIn = mockSignIn;
  },
}));

import { SyncRunner } from './sync-runner';

describe('SyncRunner login failure handling', () => {
  beforeEach(() => {
    mockDecrypt.mockReset();
    mockEncrypt.mockReset();
    mockSignIn.mockReset();

    mockDecrypt.mockImplementation((value: string) => `decrypted-${value}`);
    mockEncrypt.mockReturnValue('encrypted-token');
  });

  it('keeps credential state unchanged for transient Aurora login failures', async () => {
    const runner = new SyncRunner();
    const updateCredentialStatus = vi.spyOn(runner as any, 'updateCredentialStatus').mockResolvedValue(undefined);

    mockSignIn.mockRejectedValue(
      new AuroraRequestError({
        code: 'http',
        message: 'Aurora HTTP 503 Service Unavailable',
        status: 503,
        statusText: 'Service Unavailable',
        url: 'https://decoyboardapp.com/sessions',
      }),
    );

    await expect((runner as any).syncSingleCredential(createCredential())).rejects.toThrow(
      'Aurora HTTP 503 Service Unavailable',
    );

    expect(updateCredentialStatus).not.toHaveBeenCalled();
  });

  it('marks invalid credentials as an error', async () => {
    const runner = new SyncRunner();
    const updateCredentialStatus = vi.spyOn(runner as any, 'updateCredentialStatus').mockResolvedValue(undefined);

    mockSignIn.mockRejectedValue(
      new AuroraRequestError({
        code: 'invalid_credentials',
        message: 'Invalid username or password',
        status: 422,
        statusText: 'Unprocessable Entity',
        url: 'https://decoyboardapp.com/sessions',
      }),
    );

    await expect((runner as any).syncSingleCredential(createCredential())).rejects.toThrow(
      'Login failed: Invalid username or password',
    );

    expect(updateCredentialStatus).toHaveBeenCalledWith(
      'user-123',
      'decoy',
      'error',
      'Login failed: Invalid username or password',
    );
  });
});

function createCredential() {
  return {
    userId: 'user-123',
    boardType: 'decoy',
    encryptedUsername: 'enc-user',
    encryptedPassword: 'enc-pass',
    auroraUserId: 42,
    auroraToken: null,
    syncStatus: 'active',
    syncError: null,
    lastSyncAt: null,
  };
}

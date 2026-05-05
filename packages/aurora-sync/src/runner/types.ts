export type SyncRunnerConfig = {
  onLog?: (message: string) => void;
  onError?: (error: Error, context: { userId?: string; board?: string }) => void;
  /**
   * Minimum time between shared-sync attempts on the same board. Multiple users
   * cycling through user-sync within this window only trigger one shared-sync
   * for that board. Defaults to 1 hour.
   */
  sharedSyncCooldownMs?: number;
};

export type DaemonOptions = {
  timeZone?: string;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  quietPollMs?: number;
  minDelayMinutes?: number;
  maxDelayMinutes?: number;
};

export type SyncSummary = {
  total: number;
  successful: number;
  failed: number;
  errors: SyncError[];
};

export type SyncError = {
  userId: string;
  boardType: string;
  error: string;
};

export type CredentialRecord = {
  userId: string;
  boardType: string;
  encryptedUsername: string | null;
  encryptedPassword: string | null;
  auroraUserId: number | null;
  auroraToken: string | null;
  syncStatus: string | null;
  syncError: string | null;
  lastSyncAt: Date | null;
};

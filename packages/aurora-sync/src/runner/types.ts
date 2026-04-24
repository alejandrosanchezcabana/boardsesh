export type SyncRunnerConfig = {
  onLog?: (message: string) => void;
  onError?: (error: Error, context: { userId?: string; board?: string }) => void;
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

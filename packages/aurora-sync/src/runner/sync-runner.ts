import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, ne, and, or, isNotNull, sql } from 'drizzle-orm';

import { auroraCredentials } from '@boardsesh/db/schema/auth';
import { syncUserData } from '../sync/user-sync';
import { AuroraClimbingClient } from '../api/aurora-client';
import { isTransientAuroraError } from '../api/errors';
import { decrypt, encrypt } from '@boardsesh/crypto';
import type { AuroraBoardName } from '../api/types';
import { resolveDaemonOptions, runDaemonLoop } from './daemon';
import type { SyncRunnerConfig, SyncSummary, CredentialRecord, DaemonOptions } from './types';

type RunnerClient = ReturnType<typeof postgres>;
type RunnerDb = ReturnType<typeof drizzle>;

export class SyncRunner {
  private config: SyncRunnerConfig;
  private daemonController: AbortController | null = null;
  private client: RunnerClient | null = null;
  private db: RunnerDb | null = null;

  constructor(config: SyncRunnerConfig = {}) {
    this.config = config;
  }

  private getClient(): { client: RunnerClient; db: RunnerDb } {
    if (!this.client || !this.db) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is required');
      }
      // `prepare: false` is required for Railway's PgBouncer pooled URL
      // (transaction-pooling mode is incompatible with prepared statements).
      this.client = postgres(connectionString, {
        max: 5,
        idle_timeout: 30,
        connect_timeout: 30,
        prepare: false,
      });
      this.db = drizzle(this.client);
    }
    return { client: this.client, db: this.db };
  }

  private log(message: string): void {
    if (this.config.onLog) {
      this.config.onLog(message);
    } else {
      console.info(message);
    }
  }

  private handleError(error: Error, context: { userId?: string; board?: string }): void {
    if (this.config.onError) {
      this.config.onError(error, context);
    } else {
      console.error(`[SyncRunner] Error:`, error, context);
    }
  }

  async syncNextUser(): Promise<SyncSummary> {
    const results: SyncSummary = {
      total: 1,
      successful: 0,
      failed: 0,
      errors: [],
    };

    const cred = await this.getNextCredentialToSync();

    if (!cred) {
      this.log(`[SyncRunner] No users with Aurora credentials to sync`);
      results.total = 0;
      return results;
    }

    this.log(`[SyncRunner] Syncing next user: ${cred.userId} for ${cred.boardType}`);

    try {
      await this.syncSingleCredential(cred);
      results.successful++;
      this.log(`[SyncRunner] ✓ Successfully synced user ${cred.userId} for ${cred.boardType}`);
    } catch (error) {
      results.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({
        userId: cred.userId,
        boardType: cred.boardType,
        error: errorMsg,
      });
      this.handleError(error instanceof Error ? error : new Error(errorMsg), {
        userId: cred.userId,
        board: cred.boardType,
      });
      this.log(`[SyncRunner] ✗ Failed to sync user ${cred.userId} for ${cred.boardType}: ${errorMsg}`);
    }

    return results;
  }

  /** @deprecated Use syncNextUser() instead to avoid IP blocking */
  async syncAllUsers(): Promise<SyncSummary> {
    const results: SyncSummary = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    const credentials = await this.getActiveCredentials();
    results.total = credentials.length;

    this.log(`[SyncRunner] Found ${credentials.length} users with Aurora credentials to sync`);

    for (const cred of credentials) {
      try {
        await this.syncSingleCredential(cred);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        results.successful++;
        this.log(`[SyncRunner] ✓ Successfully synced user ${cred.userId} for ${cred.boardType}`);
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          userId: cred.userId,
          boardType: cred.boardType,
          error: errorMsg,
        });
        this.handleError(error instanceof Error ? error : new Error(errorMsg), {
          userId: cred.userId,
          board: cred.boardType,
        });
        this.log(`[SyncRunner] ✗ Failed to sync user ${cred.userId} for ${cred.boardType}: ${errorMsg}`);
      }
    }

    return results;
  }

  async syncUser(userId: string, boardType: string): Promise<void> {
    const { db } = this.getClient();
    const credentials = await db
      .select()
      .from(auroraCredentials)
      .where(and(eq(auroraCredentials.userId, userId), eq(auroraCredentials.boardType, boardType)))
      .limit(1);

    if (credentials.length === 0) {
      throw new Error(`No credentials found for user ${userId} on ${boardType}`);
    }

    const cred = credentials[0] as CredentialRecord;
    await this.syncSingleCredential(cred);
  }

  async runDaemon(options: DaemonOptions = {}): Promise<void> {
    if (this.daemonController && !this.daemonController.signal.aborted) {
      throw new Error('Daemon mode is already running');
    }

    const resolved = resolveDaemonOptions(options);
    const controller = new AbortController();
    this.daemonController = controller;

    this.log(
      `[SyncRunner] Starting daemon mode (${resolved.timeZone}, quiet ${resolved.quietHoursStart}:00-${resolved.quietHoursEnd}:00, random interval ${resolved.minDelayMinutes}-${resolved.maxDelayMinutes} minutes)`,
    );

    try {
      await runDaemonLoop(
        async () => {
          await this.syncNextUser();
        },
        resolved,
        {
          signal: controller.signal,
          onLog: this.log.bind(this),
          onCycleError: (error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            this.handleError(err, {});
            this.log(`[SyncRunner] Daemon cycle failed: ${err.message}`);
          },
        },
      );
    } finally {
      this.daemonController = null;
      this.log('[SyncRunner] Daemon mode stopped');
    }
  }

  private syncableCredentialsFilter() {
    return and(
      or(
        eq(auroraCredentials.syncStatus, 'pending'),
        eq(auroraCredentials.syncStatus, 'active'),
        eq(auroraCredentials.syncStatus, 'error'),
      ),
      isNotNull(auroraCredentials.encryptedUsername),
      isNotNull(auroraCredentials.encryptedPassword),
      isNotNull(auroraCredentials.auroraUserId),
      ne(auroraCredentials.boardType, 'kilter'),
    );
  }

  private async getActiveCredentials(): Promise<CredentialRecord[]> {
    const { db } = this.getClient();
    const credentials = await db.select().from(auroraCredentials).where(this.syncableCredentialsFilter());
    return credentials as CredentialRecord[];
  }

  private async getNextCredentialToSync(): Promise<CredentialRecord | null> {
    const { db } = this.getClient();
    const credentials = await db
      .select()
      .from(auroraCredentials)
      .where(this.syncableCredentialsFilter())
      .orderBy(sql`${auroraCredentials.lastSyncAt} ASC NULLS FIRST`)
      .limit(1);

    return credentials.length > 0 ? (credentials[0] as CredentialRecord) : null;
  }

  private async syncSingleCredential(cred: CredentialRecord): Promise<void> {
    if (!cred.encryptedUsername || !cred.encryptedPassword || !cred.auroraUserId) {
      throw new Error('Missing credentials or user ID');
    }

    const boardType = cred.boardType as AuroraBoardName;

    let username: string;
    let password: string;
    try {
      username = decrypt(cred.encryptedUsername);
      password = decrypt(cred.encryptedPassword);
    } catch (decryptError) {
      const errorMessage = `Decryption failed: ${this.formatErrorMessage(decryptError)}`;
      await this.updateCredentialStatus(cred.userId, cred.boardType, 'error', errorMessage);
      throw new Error(errorMessage);
    }

    this.log(`[SyncRunner] Getting fresh token for user ${cred.userId} (${boardType})...`);
    const auroraClient = new AuroraClimbingClient({ boardName: boardType });
    let token: string;

    try {
      const loginResponse = await auroraClient.signIn(username, password);
      if (!loginResponse.token) {
        throw new Error('Login succeeded but no token returned');
      }
      token = loginResponse.token;
    } catch (loginError) {
      if (isTransientAuroraError(loginError)) {
        this.log(
          `[SyncRunner] Transient Aurora login error for user ${cred.userId} (${boardType}); will retry later: ${(loginError as Error).message}`,
        );
        throw loginError;
      }

      const errorMessage = `Login failed: ${this.formatErrorMessage(loginError)}`;
      await this.updateCredentialStatus(cred.userId, cred.boardType, 'error', errorMessage);
      throw new Error(errorMessage);
    }

    await this.updateStoredToken(cred.userId, cred.boardType, token);

    const { client } = this.getClient();
    this.log(`[SyncRunner] Syncing user ${cred.userId} for ${boardType}...`);
    await syncUserData(client, boardType, token, cred.auroraUserId, cred.userId, undefined, this.log.bind(this));
    await this.updateCredentialStatus(cred.userId, cred.boardType, 'active', null, new Date());
  }

  private async updateCredentialStatus(
    userId: string,
    boardType: string,
    status: string,
    error: string | null,
    lastSyncAt?: Date,
  ): Promise<void> {
    const { db } = this.getClient();
    const updateData: Record<string, unknown> = {
      syncStatus: status,
      syncError: error,
      updatedAt: new Date(),
    };

    if (lastSyncAt) {
      updateData.lastSyncAt = lastSyncAt;
    }

    await db
      .update(auroraCredentials)
      .set(updateData)
      .where(and(eq(auroraCredentials.userId, userId), eq(auroraCredentials.boardType, boardType)));
  }

  private async updateStoredToken(userId: string, boardType: string, token: string): Promise<void> {
    const encryptedToken = encrypt(token);
    const { db } = this.getClient();
    await db
      .update(auroraCredentials)
      .set({
        auroraToken: encryptedToken,
        updatedAt: new Date(),
      })
      .where(and(eq(auroraCredentials.userId, userId), eq(auroraCredentials.boardType, boardType)));
  }

  async close(): Promise<void> {
    this.daemonController?.abort();
    if (this.client) {
      try {
        await this.client.end();
      } finally {
        this.client = null;
        this.db = null;
      }
    }
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

export default SyncRunner;

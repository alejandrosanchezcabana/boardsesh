import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { eq, ne, and, or, isNotNull, sql } from 'drizzle-orm';
import ws from 'ws';

import { auroraCredentials } from '@boardsesh/db/schema/auth';
import { syncUserData } from '../sync/user-sync';
import { AuroraClimbingClient } from '../api/aurora-client';
import { isTransientAuroraError } from '../api/errors';
import { decrypt, encrypt } from '@boardsesh/crypto';
import type { AuroraBoardName } from '../api/types';
import { resolveDaemonOptions, runDaemonLoop } from './daemon';
import type { SyncRunnerConfig, SyncSummary, CredentialRecord, DaemonOptions } from './types';

// Configure WebSocket constructor for Node.js environment
neonConfig.webSocketConstructor = ws;

/**
 * Create a fresh pool for each operation to avoid stale WebSocket connections
 */
function createFreshPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000, // Short idle timeout to avoid stale connections
    max: 5,
  });
}

/**
 * Create HTTP-based Drizzle instance for simple queries (no transactions needed)
 */
function createHttpDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const sql = neon(connectionString);
  return drizzleHttp({ client: sql });
}

export class SyncRunner {
  private config: SyncRunnerConfig;
  private daemonController: AbortController | null = null;

  constructor(config: SyncRunnerConfig = {}) {
    this.config = config;
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

  /**
   * Sync the next user that needs syncing (oldest lastSyncAt first)
   * Only syncs 1 user per call to avoid IP blocking from Aurora API
   */
  async syncNextUser(): Promise<SyncSummary> {
    const results: SyncSummary = {
      total: 1,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Get the next credential to sync (oldest lastSyncAt first)
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

  /**
   * @deprecated Use syncNextUser() instead to avoid IP blocking
   * Sync all users with syncable credentials
   */
  async syncAllUsers(): Promise<SyncSummary> {
    const results: SyncSummary = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Get credentials list using HTTP (simple query, no transaction needed)
    const credentials = await this.getActiveCredentials();
    results.total = credentials.length;

    this.log(`[SyncRunner] Found ${credentials.length} users with Aurora credentials to sync`);

    // Sync each user sequentially with fresh connection per user
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

  /**
   * Sync a specific user by NextAuth userId and board type
   */
  async syncUser(userId: string, boardType: string): Promise<void> {
    // Use HTTP for simple lookup query
    const db = createHttpDb();
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

    // Resolve once here so startup config errors (e.g. equal quiet hours) surface
    // before we spawn an AbortController or log "Starting daemon mode".
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

  // Shared WHERE clause for credentials that are eligible to be synced.
  // Kilter is excluded because the Kilter backend is permanently down.
  //
  // Sync statuses picked up:
  //   - 'pending': newly linked credentials that haven't been synced yet.
  //     The daemon bootstraps them on its first cycle.
  //   - 'active': regularly-synced credentials.
  //   - 'error': previously failed credentials — retry so transient-classified
  //     failures recover automatically. `sync_error` gets overwritten each retry.
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
    // Use HTTP for simple lookup query (no transaction needed)
    const db = createHttpDb();
    const credentials = await db.select().from(auroraCredentials).where(this.syncableCredentialsFilter());

    return credentials as CredentialRecord[];
  }

  private async getNextCredentialToSync(): Promise<CredentialRecord | null> {
    // Use HTTP for simple lookup query (no transaction needed)
    // Get the credential with the oldest lastSyncAt (or null = never synced)
    const db = createHttpDb();
    const credentials = await db
      .select()
      .from(auroraCredentials)
      .where(this.syncableCredentialsFilter())
      .orderBy(sql`${auroraCredentials.lastSyncAt} ASC NULLS FIRST`) // Never-synced users first, then oldest
      .limit(1);

    return credentials.length > 0 ? (credentials[0] as CredentialRecord) : null;
  }

  private async syncSingleCredential(cred: CredentialRecord): Promise<void> {
    if (!cred.encryptedUsername || !cred.encryptedPassword || !cred.auroraUserId) {
      throw new Error('Missing credentials or user ID');
    }

    const boardType = cred.boardType as AuroraBoardName;

    // Decrypt credentials
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

    // Get fresh token by logging in
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
          `[SyncRunner] Transient Aurora login error for user ${cred.userId} (${boardType}); will retry later: ${loginError.message}`,
        );
        throw loginError;
      }

      const errorMessage = `Login failed: ${this.formatErrorMessage(loginError)}`;
      await this.updateCredentialStatus(cred.userId, cred.boardType, 'error', errorMessage);
      throw new Error(errorMessage);
    }

    // Update stored token
    await this.updateStoredToken(cred.userId, cred.boardType, token);

    // Create a fresh pool for this sync operation to avoid stale connections
    const pool = createFreshPool();
    try {
      // Sync user data - pass NextAuth userId directly since we have it
      this.log(`[SyncRunner] Syncing user ${cred.userId} for ${boardType}...`);
      await syncUserData(pool, boardType, token, cred.auroraUserId, cred.userId, undefined, this.log.bind(this));

      // Update last sync time on success
      await this.updateCredentialStatus(cred.userId, cred.boardType, 'active', null, new Date());
    } finally {
      // Always close the pool when done
      await pool.end();
    }
  }

  private async updateCredentialStatus(
    userId: string,
    boardType: string,
    status: string,
    error: string | null,
    lastSyncAt?: Date,
  ): Promise<void> {
    // Use HTTP for simple update (no transaction needed)
    const db = createHttpDb();
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
    // Use HTTP for simple update (no transaction needed)
    const db = createHttpDb();
    await db
      .update(auroraCredentials)
      .set({
        auroraToken: encryptedToken,
        updatedAt: new Date(),
      })
      .where(and(eq(auroraCredentials.userId, userId), eq(auroraCredentials.boardType, boardType)));
  }

  /**
   * Close is now a no-op since we create fresh pools per operation
   */
  async close(): Promise<void> {
    this.daemonController?.abort();
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

export default SyncRunner;

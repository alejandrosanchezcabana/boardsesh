import { drizzle } from 'drizzle-orm/postgres-js';
import type { Logger } from 'drizzle-orm';
import postgres from 'postgres';
import { getConnectionConfig } from './config';
import * as schema from '../schema/index';
import * as relations from '../relations/index';

class QueryLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    const timestamp = new Date().toISOString();
    console.info(`[SQL ${timestamp}] ${query}`);
    if (params.length > 0) {
      console.info(`[SQL params] ${JSON.stringify(params)}`);
    }
  }
}

const sqlLogger = process.env.DEBUG_SQL === 'true' ? new QueryLogger() : undefined;

const fullSchema = { ...schema, ...relations };

// `prepare: false` is required when the target is PgBouncer in transaction
// pooling mode (Railway's pooled URL): backends are reused across transactions
// so per-connection prepared statement caches collide. The flag is a safe no-op
// against direct PostgreSQL.
const POOL_OPTIONS = {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 30,
  prepare: false,
} as const;

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

let readClient: ReturnType<typeof postgres> | null = null;
let readDb: ReturnType<typeof drizzle> | null = null;

export function createDb() {
  if (!db) {
    const { connectionString } = getConnectionConfig();
    client = postgres(connectionString, POOL_OPTIONS);
    db = drizzle(client, { schema: fullSchema, logger: sqlLogger });
  }
  return db;
}

export function createPool() {
  if (!client) {
    createDb();
  }
  return client!;
}

export async function closePool(): Promise<void> {
  try {
    if (client) {
      await client.end();
    }
  } finally {
    client = null;
    db = null;
  }
}

/**
 * Returns a drizzle instance pointed at READ_REPLICA_URL. When the env var is
 * unset, returns the primary `db` so call sites don't need to branch — this
 * makes wiring the seam in safe before a replica exists.
 */
export function createReadDb() {
  const { readReplicaUrl } = getConnectionConfig();
  if (!readReplicaUrl) {
    return createDb();
  }
  if (!readDb) {
    readClient = postgres(readReplicaUrl, POOL_OPTIONS);
    readDb = drizzle(readClient, { schema: fullSchema, logger: sqlLogger });
  }
  return readDb;
}

export function createReadPool() {
  const { readReplicaUrl } = getConnectionConfig();
  if (!readReplicaUrl) {
    return createPool();
  }
  if (!readClient) {
    createReadDb();
  }
  return readClient!;
}

export async function closeReadPool(): Promise<void> {
  try {
    if (readClient) {
      await readClient.end();
    }
  } finally {
    readClient = null;
    readDb = null;
  }
}

export type DbInstance = ReturnType<typeof createDb>;
export type PoolInstance = ReturnType<typeof postgres>;

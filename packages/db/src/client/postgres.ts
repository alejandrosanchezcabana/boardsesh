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

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function createDb() {
  if (!db) {
    const { connectionString } = getConnectionConfig();
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 30,
    });
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

export type DbInstance = ReturnType<typeof createDb>;
export type PoolInstance = ReturnType<typeof postgres>;

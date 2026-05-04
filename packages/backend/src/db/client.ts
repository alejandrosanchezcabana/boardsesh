// Re-export db client from @boardsesh/db
import { createDb, createReadDb } from '@boardsesh/db/client';

// Singleton primary client for the backend (writes + auth + party-mode reads).
export const db = createDb();

// Singleton replica-aware client for read-heavy paths (search, feed,
// analytics). Falls back to the primary when READ_REPLICA_URL is unset.
export const dbRead = createReadDb();

export type Database = typeof db;

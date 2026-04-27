import 'server-only';
import postgres from 'postgres';
import { getConnectionConfig, createDb } from '@boardsesh/db/client';

export { createDb as getDb, createPool as getPool } from '@boardsesh/db/client';
export { getConnectionConfig } from '@boardsesh/db/client';

const { connectionString } = getConnectionConfig();

export const sql = postgres(connectionString, { max: 10, idle_timeout: 30 });

export const dbz = createDb();

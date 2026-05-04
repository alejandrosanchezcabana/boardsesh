import 'server-only';
import { createDb, createPool, createReadDb } from '@boardsesh/db/client';

export {
  createDb as getDb,
  createPool as getPool,
  closePool,
  createReadDb as getReadDb,
  createReadPool as getReadPool,
  closeReadPool,
  getConnectionConfig,
} from '@boardsesh/db/client';

// Shared singletons. Both `sql` (postgres-js tagged template) and `dbz`
// (drizzle) are backed by the same pool from @boardsesh/db/client so a Vercel
// function instance opens one pool, not two.
export const sql = createPool();
export const dbz = createDb();
export const dbzRead = createReadDb();

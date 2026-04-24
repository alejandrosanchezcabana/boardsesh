import 'server-only';
import { neon } from '@neondatabase/serverless';
import { configureNeonForEnvironment, getConnectionConfig } from '@boardsesh/db/client';
import { createNeonHttp } from '@boardsesh/db/client';

// Re-export from @boardsesh/db with server-only protection
export { createDb as getDb, createPool as getPool, createNeonHttp } from '@boardsesh/db/client';
export { configureNeonForEnvironment, getConnectionConfig } from '@boardsesh/db/client';

// Configure and export the raw SQL template literal function

// Configure Neon for the environment
configureNeonForEnvironment();
const { connectionString } = getConnectionConfig();

// Export the neon SQL template literal function for raw SQL queries
export const sql = neon(connectionString);

// For backward compatibility (some code may use dbz)
export const dbz = createNeonHttp();

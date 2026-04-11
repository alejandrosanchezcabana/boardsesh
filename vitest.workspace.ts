import { defineWorkspace } from 'vitest/config'

/**
 * Root-level vitest workspace for file-based test selection across the monorepo.
 *
 * Usage from the repo root:
 *   vitest run                                               # run all tests
 *   vitest run packages/web/app/__tests__/foo.test.ts        # run a specific file
 *   vitest --project web                                     # run only web tests
 *   vitest --project backend                                 # run only backend tests
 *   vitest --project moonboard-ocr                           # run only moonboard-ocr tests
 *
 * Note: backend tests require a running PostgreSQL (port 5433) and Redis (port 6380).
 * Run `bun run db:up` first when selecting backend tests.
 */
export default defineWorkspace([
  './packages/web/vitest.config.ts',
  './packages/backend/vitest.config.ts',
  './packages/moonboard-ocr/vitest.config.ts',
])

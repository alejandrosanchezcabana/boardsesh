import { defineConfig } from 'vitest/config';

// Configuration for unit tests that don't require a database connection.
// Run with: vitest run --config vitest.unit.config.ts
export default defineConfig({
  test: {
    name: 'backend-unit',
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 10000,
  },
});

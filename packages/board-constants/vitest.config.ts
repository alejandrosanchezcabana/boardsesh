import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'board-constants',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

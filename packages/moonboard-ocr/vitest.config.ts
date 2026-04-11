import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'moonboard-ocr',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});

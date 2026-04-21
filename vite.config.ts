import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [],
  },
  test: {
    projects: [
      "./packages/web/vite.config.ts",
      "./packages/backend/vite.config.ts",
      "./packages/moonboard-ocr/vite.config.ts",
      "./packages/board-constants/vite.config.ts",
    ],
  },
  staged: {
    "*.{ts,tsx,js,mjs,cjs}": "vp check --fix",
  },
  run: {
    cache: true,
  },
});

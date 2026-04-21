import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "moonboard-ocr",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});

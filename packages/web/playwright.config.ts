import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? "github" : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    // Main functional E2E tests - desktop Chrome.
    // Screenshot-only specs are excluded here; they run in their own projects below.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/app-store-screenshots.spec.ts", "**/help-screenshots.spec.ts"],
    },

    // Help page screenshots - mobile viewport (390×844, matches iPhone 14 logical size).
    // Viewport is set at the project level so both describe blocks in the spec use it
    // without needing redundant test.use() calls inside each describe.
    {
      name: "help-screenshots",
      use: { viewport: { width: 390, height: 844 } },
      testMatch: ["**/help-screenshots.spec.ts"],
    },

    // App Store screenshots - iPhone 16 Pro Max (440×956 @ 3×).
    // Run manually when generating App Store assets:
    //   cd packages/web && bunx playwright test --project=app-store-screenshots
    {
      name: "app-store-screenshots",
      use: {
        viewport: { width: 440, height: 956 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      },
      testMatch: ["**/app-store-screenshots.spec.ts"],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined // In CI, we expect the server to be started separately
    : {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});

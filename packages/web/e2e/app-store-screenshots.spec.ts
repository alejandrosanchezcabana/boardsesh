/**
 * App Store Screenshot Generation
 *
 * Captures screenshots at iPhone 15 Pro Max resolution for App Store submission.
 * Screenshots are saved to mobile/screenshots/ for upload to App Store Connect.
 *
 * Run via the dedicated Playwright project (viewport set in playwright.config.ts):
 *   cd packages/web && bunx playwright test --project=app-store-screenshots
 *
 * Run with authenticated scenes (queue, party mode):
 *   TEST_USER_EMAIL=$(op read "op://Boardsesh/Boardsesh local/username") \
 *   TEST_USER_PASSWORD=$(op read "op://Boardsesh/Boardsesh local/password") \
 *   bunx playwright test --project=app-store-screenshots
 *
 * Prerequisites:
 *   - Dev server running: bun run dev
 *   - For authenticated tests: 1Password CLI installed and signed in
 *
 * Required App Store sizes:
 *   - 6.9" (iPhone 16 Pro Max): 1320x2868 -- screenshots taken at this logical size
 *   - 6.5" (iPhone 14 Plus): 1284x2778 -- App Store Connect accepts 6.9" for this slot
 *   - 12.9" iPad: 2048x2732 -- optional, not covered here
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../mobile/screenshots');
const boardUrl = '/kilter/original/12x12-square/screw_bolt/40/list';

// Board-page screenshots: beforeEach navigates to the board list.
// Viewport and device settings come from the app-store-screenshots project in playwright.config.ts.
test.describe('App Store Screenshots', () => {
  // Seven tests all hitting the same board URL at 3× scale against a
  // single dev server. Running them serially eliminates parallel
  // contention (race on onboarding IDs, queue state, drawer animations)
  // at the cost of ~30s of wall-clock.
  test.describe.configure({ mode: 'serial' });

  // These are heavy pages at 3x scale -- give them room to load
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page
      .waitForSelector('#onboarding-climb-card, [data-testid="climb-card"]', { timeout: 60_000 })
      .catch(() => page.waitForLoadState('networkidle'));
    // Let React finish hydrating before any test body fires events —
    // clicking before `onClick` handlers are attached is a common source
    // of "click looked fine but nothing happened" flakes.
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('01-climb-list', async ({ page }) => {
    // Main browse interface showing climb cards with grades and ratings
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-climb-list.png` });
  });

  test('02-search-filters', async ({ page }) => {
    // Open the filters drawer (header button with aria-label="Open filters").
    // Note: `#onboarding-search-button` is the search input wrapper, not the
    // filter trigger — it focuses the textbox but does not open the drawer.
    await page.getByRole('button', { name: 'Open filters' }).click();
    await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-search-filters.png` });
  });

  test('03-board-view', async ({ page }) => {
    // Tap the first climb's thumbnail — this is wired to select the climb
    // AND dispatch the open-play-drawer event, so it reliably lands in the
    // right state on both desktop and mobile without relying on dblclick.
    const thumbnail = page.locator('#onboarding-climb-card [data-testid="climb-thumbnail"]');
    await thumbnail.waitFor({ state: 'visible', timeout: 15000 });
    await thumbnail.click();

    await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 15000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-board-view.png` });
  });

  test('04-queue', async ({ page }) => {
    // Tapping a climb row dispatches setCurrentClimb with shouldAddToQueue,
    // so each click appends a new queue item. Click the first row three
    // times to populate the queue without relying on selectors for
    // non-onboarding rows (which don't carry stable test IDs in list mode).
    const firstRow = page.locator('#onboarding-climb-card');
    await firstRow.waitFor({ state: 'visible', timeout: 15000 });
    for (let i = 0; i < 3; i++) {
      await firstRow.click();
      await page.waitForTimeout(300);
    }

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-queue.png` });
  });

  test('05-bluetooth', async ({ page }) => {
    // Open the play drawer by tapping the first climb's thumbnail (same
    // reliable path as 03-board-view) so Bluetooth UI is reachable.
    const thumbnail = page.locator('#onboarding-climb-card [data-testid="climb-thumbnail"]');
    await thumbnail.waitFor({ state: 'visible', timeout: 15000 });
    await thumbnail.click();

    await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 15000 });

    // Click the Bluetooth/connect button if visible in the play drawer.
    // Web Bluetooth isn't available in Playwright's headless Chromium, so
    // the button may or may not render — capture whichever state we get.
    const bleButton = page.getByLabel('Connect to board').or(page.getByLabel('Bluetooth'));
    if (await bleButton.isVisible().catch(() => false)) {
      await bleButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-bluetooth.png` });
  });

  test('06-party-mode', async ({ page }) => {
    // Tap the climb row directly — going up to its virtualizer parent via
    // .locator('..') lands the click on non-interactive padding and
    // misses the row's onClick handler.
    const row = page.locator('#onboarding-climb-card');
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.click();

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    // The "Start sesh" affordance lives inside the queue bar (queue-control-bar.tsx:948).
    // Click it to open the session-start drawer for the screenshot.
    const startSeshTrigger = queueBar.getByText('Start sesh');
    if (await startSeshTrigger.isVisible().catch(() => false)) {
      await startSeshTrigger.click();
      await page
        .locator('[data-swipeable-drawer="true"]:visible')
        .first()
        .waitFor({ timeout: 5000 })
        .catch(() => {
          // If the drawer doesn't open (e.g. blocked by auth guard), fall
          // back to screenshotting the queue bar with the climb loaded.
        });
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-party-mode.png` });
  });

  // Home page (board selection) screenshot -- navigates away from boardUrl
  test('00-home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for board selection cards to render
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-home.png` });
  });
});

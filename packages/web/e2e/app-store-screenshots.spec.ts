/**
 * App Store Screenshot Generation
 *
 * Captures screenshots at iPhone 15 Pro Max resolution for App Store submission.
 * Screenshots are saved to mobile/screenshots/ for upload to App Store Connect.
 *
 * Run (unauthenticated scenes only):
 *   bunx playwright test e2e/app-store-screenshots.spec.ts
 *
 * Run with authenticated scenes (queue, party mode):
 *   TEST_USER_EMAIL=$(op read "op://Boardsesh/Boardsesh local/username") \
 *   TEST_USER_PASSWORD=$(op read "op://Boardsesh/Boardsesh local/password") \
 *   bunx playwright test e2e/app-store-screenshots.spec.ts
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

// iPhone 15 Pro Max logical viewport. Playwright renders at 1x by default,
// so we set deviceScaleFactor to get the actual App Store resolution.
// 1320x2868 at 3x = 440x956 logical pixels.
const VIEWPORT = { width: 440, height: 956 };
const DEVICE_SCALE_FACTOR = 3;

test.describe('App Store Screenshots', () => {
  // These are heavy pages at 3x scale -- give them room to load
  test.setTimeout(90_000);

  test.use({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page
      .waitForSelector('#onboarding-climb-card, [data-testid="climb-card"]', { timeout: 60_000 })
      .catch(() => page.waitForLoadState('networkidle'));
  });

  test('01-climb-list', async ({ page }) => {
    // Main browse interface showing climb cards with grades and ratings
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-climb-list.png` });
  });

  test('02-search-filters', async ({ page }) => {
    // Open search drawer to show filtering options
    await page.locator('#onboarding-search-button').click();
    await page.getByText('Grade').first().waitFor({ state: 'visible' });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-search-filters.png` });
  });

  test('03-board-view', async ({ page }) => {
    // Double-click first climb to add to queue, then open play drawer to show board
    const climbCard = page.locator('#onboarding-climb-card');
    await climbCard.dblclick();

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    // Open play drawer to show the climb on the board
    await page.locator('#onboarding-queue-toggle').click();
    await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-board-view.png` });
  });

  test('04-queue', async ({ page }) => {
    // Add multiple climbs to show the queue functionality
    const climbCards = page.locator('[data-testid="climb-card"], #onboarding-climb-card');
    const count = await climbCards.count();

    // Double-click up to 3 climbs to populate the queue
    for (let i = 0; i < Math.min(3, count); i++) {
      await climbCards.nth(i).dblclick();
      // Brief pause between adds
      await page.waitForTimeout(300);
    }

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-queue.png` });
  });

  test('05-bluetooth', async ({ page }) => {
    // Add a climb to get the queue bar, then show Bluetooth UI
    const climbCard = page.locator('#onboarding-climb-card');
    await climbCard.dblclick();

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    // Open the play drawer and look for BLE connection button
    await page.locator('#onboarding-queue-toggle').click();
    await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 10000 });

    // Click the Bluetooth/connect button if visible in the play drawer
    const bleButton = page.getByLabel('Connect to board').or(page.getByLabel('Bluetooth'));
    if (await bleButton.isVisible().catch(() => false)) {
      await bleButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-bluetooth.png` });
  });

  test('06-party-mode', async ({ page }) => {
    // Add a climb so the queue bar appears
    const climbCard = page.locator('#onboarding-climb-card');
    await climbCard.dblclick();

    const queueBar = page.locator('[data-testid="queue-control-bar"]');
    await expect(queueBar).toBeVisible({ timeout: 10000 });

    // The share/party button is rendered by ShareBoardButton inside the queue bar.
    // Find it by looking for the icon button after the nav buttons, or by its SVG icon.
    const partyButton = page.locator('[data-testid="queue-control-bar"] button').filter({ has: page.locator('svg') });
    const buttons = await partyButton.all();

    // Debug: try to click the share/party button (typically the 3rd or 4th button in the bar)
    // If there aren't enough buttons, just screenshot the queue bar as-is
    let drawerOpened = false;
    for (const btn of buttons) {
      const label = await btn.getAttribute('aria-label').catch(() => '');
      if (label && (label.toLowerCase().includes('party') || label.toLowerCase().includes('share') || label.toLowerCase().includes('sesh'))) {
        await btn.click();
        drawerOpened = await page.locator('[data-swipeable-drawer="true"]:visible').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        break;
      }
    }

    if (!drawerOpened) {
      // Fallback: screenshot the queue bar with the climb loaded - still useful
      console.log('Party mode button not found on production, capturing queue bar instead');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-party-mode.png` });
  });
});

// Home page screenshot (board selection) - separate describe since different URL
test.describe('App Store Screenshots - Home', () => {
  test.use({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('00-home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for board selection cards to render
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-home.png` });
  });
});

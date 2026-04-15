/**
 * E2E tests for the ascent badge in grid mode.
 *
 * The list mode has always shown a tick badge (✓ or ✗) on climbs the
 * logged-in user has attempted. Grid mode previously didn't show this.
 * These tests verify that the badge now renders correctly in grid mode.
 *
 * Requires the seeded dev database (bun run db:up). The test user
 * (test@boardsesh.com / test) has ~2000 Kilter logbook entries from the
 * social seed script, so there will always be visible badges.
 *
 * See: https://github.com/boardsesh/boardsesh/issues/1559
 */
import { test, expect, type Page } from '@playwright/test';

const BOARD_URL = '/kilter/original/12x12-square/screw_bolt/40/list';
const ASCENT_BADGE = '[data-testid="ascent-badge"]';
const CLIMB_CARD = '[data-testid="climb-card"]';

async function login(page: Page) {
  await page.goto('/auth/login?callbackUrl=' + encodeURIComponent(BOARD_URL));
  await page.getByLabel('Email').fill('test@boardsesh.com');
  await page.getByLabel('Password').fill('test');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(BOARD_URL, { timeout: 20_000 });
}

async function waitForClimbs(page: Page) {
  await page.waitForSelector(`${CLIMB_CARD}, #onboarding-climb-card`, { timeout: 30_000 });
}

test.describe('Grid mode — ascent badge', () => {
  test.setTimeout(90_000);

  test('ascent badge appears on climb cards in grid mode', async ({ page }) => {
    await login(page);
    await waitForClimbs(page);

    // Switch to grid mode
    const gridButton = page.getByRole('button', { name: 'Grid view' });
    await expect(gridButton).toBeVisible({ timeout: 10_000 });
    await gridButton.click();

    // Wait for at least one grid card to render
    await expect(page.locator(CLIMB_CARD).first()).toBeVisible({ timeout: 15_000 });

    // At least one badge must appear — the seeded test user has ~2000 Kilter ticks
    const badges = page.locator(CLIMB_CARD).locator(ASCENT_BADGE);
    await expect(badges.first()).toBeVisible({ timeout: 10_000 });
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test('ascent badge is visible in both list and grid mode', async ({ page }) => {
    await login(page);
    await waitForClimbs(page);

    // List mode: count visible badges in the first few rendered items
    const listBadges = page.locator(ASCENT_BADGE);
    await expect(listBadges.first()).toBeVisible({ timeout: 10_000 });
    const listCount = await listBadges.count();
    expect(listCount).toBeGreaterThan(0);

    // Switch to grid mode
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.locator(CLIMB_CARD).first()).toBeVisible({ timeout: 15_000 });

    // Grid mode must also show badges
    const gridBadges = page.locator(CLIMB_CARD).locator(ASCENT_BADGE);
    await expect(gridBadges.first()).toBeVisible({ timeout: 10_000 });
    expect(await gridBadges.count()).toBeGreaterThan(0);
  });

  test('no ascent badge shown when logged out', async ({ page }) => {
    // Visit without logging in
    await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded' });
    await waitForClimbs(page);

    // Switch to grid mode
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.locator(CLIMB_CARD).first()).toBeVisible({ timeout: 15_000 });

    // No badges should appear when unauthenticated
    await expect(page.locator(CLIMB_CARD).locator(ASCENT_BADGE).first()).not.toBeVisible();
  });
});

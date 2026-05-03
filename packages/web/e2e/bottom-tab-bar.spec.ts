import { type Page, test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * E2E tests for the bottom tab bar navigation.
 *
 * These tests verify that the bottom tab bar is always visible,
 * navigation works correctly, active states are displayed, and
 * it coexists properly with the queue control bar.
 */

const boardUrl = '/kilter/original/12x12-square/screw_bolt/40/list';
const bottomTabBar = '[data-testid="bottom-tab-bar"]';
const queueControlBar = '[data-testid="queue-control-bar"]';

async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator(bottomTabBar)).toBeVisible({ timeout: 15000 });
}

// Scoped tab button selector to avoid ambiguity with multiple bars during transitions
function bottomTabButton(page: Page, name: string, exact = false) {
  return page.locator(bottomTabBar).getByRole('button', { name, exact });
}

test.describe('Bottom Tab Bar - Visibility', () => {
  test('should be visible on the home page', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('should be visible on a board page', async ({ page }) => {
    await page.goto(boardUrl);
    await waitForPageReady(page);
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('should be visible on the settings page', async ({ page }) => {
    await page.goto('/settings');
    await waitForPageReady(page);
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('should be visible on the notifications page', async ({ page }) => {
    await page.goto('/notifications');
    await waitForPageReady(page);
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('should be visible on the playlists page', async ({ page }) => {
    await page.goto('/playlists');
    await waitForPageReady(page);
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });
});

test.describe('Bottom Tab Bar - Navigation', () => {
  test('Home tab should navigate to home page', async ({ page }) => {
    await page.goto(boardUrl);
    await waitForPageReady(page);

    await bottomTabButton(page, 'Home').click();
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('Climb tab should navigate to board page', async ({ page }) => {
    // First visit a board page to establish board context in IndexedDB
    await page.goto(boardUrl);
    await waitForPageReady(page);

    // Navigate to home
    await bottomTabButton(page, 'Home').click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // Now click Climb - should navigate back using last used board
    await bottomTabButton(page, 'Climb', true).click();
    await expect(page).toHaveURL(/\/(kilter|tension)\//, { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('Discover tab should navigate to playlists page', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    await bottomTabButton(page, 'Discover').click();
    await expect(page).toHaveURL(/\/playlists/, { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('notifications bell in global header should navigate to /notifications', async ({ page }) => {
    // The bell is not rendered on `/` (HIDDEN_HEADER_PAGES suppresses the full header
    // there). `/you` renders the full header with the bell unconditionally.
    await loginAs(page, '/you');
    await waitForPageReady(page);

    // The bell is rendered as `<IconButton component={LocaleLink} href="/notifications" />`.
    // MUI 7 emits role="button" on the polymorphic anchor, so target by href to stay
    // resilient regardless of whether the implicit role lands as "link" or "button".
    // No `.first()` — strict mode catches it if the header ever renders two bells
    // (e.g. desktop + mobile slot) so we don't silently click whichever happens
    // to be first. Also waits for the anchor to ensure the global-header has
    // hydrated before we click.
    const bell = page.locator('header a[href="/notifications"]');
    await expect(bell).toBeVisible({ timeout: 15000 });
    await bell.click();
    await expect(page).toHaveURL(/\/notifications/, { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('You tab should open auth modal when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    await bottomTabButton(page, 'You').click();

    // The auth modal title is the guard defined at bottom-tab-bar.tsx:322
    await expect(page.getByText('Sign in to see your progress')).toBeVisible({ timeout: 10000 });
    // Should NOT have navigated away from /
    await expect(page).toHaveURL('/');
  });

  test('You tab should navigate to /you when authenticated', async ({ page }) => {
    await loginAs(page, '/');
    await waitForPageReady(page);

    await bottomTabButton(page, 'You').click();
    await expect(page).toHaveURL(/\/you$/, { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });

  test('Create tab should navigate to create climb page', async ({ page }) => {
    await page.goto(boardUrl);
    await waitForPageReady(page);

    await bottomTabButton(page, 'Create').click();

    await expect(page).toHaveURL(/\/create$/, { timeout: 15000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();
  });
});

test.describe('Bottom Tab Bar - Active State', () => {
  // MUI BottomNavigationAction does not render aria-selected; the Mui-selected
  // CSS class is the only indicator of the active tab state.
  test('Home tab should be active on home page', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    await expect(bottomTabButton(page, 'Home')).toHaveClass(/Mui-selected/);
  });

  test('Climb tab should be active on board routes', async ({ page }) => {
    await page.goto(boardUrl);
    await waitForPageReady(page);

    await expect(bottomTabButton(page, 'Climb', true)).toHaveClass(/Mui-selected/);
  });

  test('Discover tab should be active on playlists page', async ({ page }) => {
    await page.goto('/playlists');
    await waitForPageReady(page);

    await expect(bottomTabButton(page, 'Discover')).toHaveClass(/Mui-selected/);
  });

  test('You tab should be active on /you when authenticated', async ({ page }) => {
    await loginAs(page, '/you');
    await waitForPageReady(page);

    await expect(bottomTabButton(page, 'You')).toHaveClass(/Mui-selected/);
  });
});

test.describe('Bottom Tab Bar - Queue Integration', () => {
  test('queue bar and bottom tab bar should coexist with correct climb', async ({ page }) => {
    await page.goto(boardUrl);
    await page
      .waitForSelector('#onboarding-climb-card, [data-testid="climb-card"]', { timeout: 30000 })
      .catch(() => page.waitForLoadState('domcontentloaded'));

    // Add a climb to the queue
    const climbCard = page.locator('#onboarding-climb-card');
    await expect(climbCard).toBeVisible({ timeout: 15000 });
    await climbCard.dblclick();

    // Both bars should be visible
    await expect(page.locator(queueControlBar)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(bottomTabBar)).toBeVisible();

    // Verify the queue bar shows the climb name
    const queueToggle = page.locator('#onboarding-queue-toggle');
    await expect(queueToggle).toBeVisible({ timeout: 5000 });
    const climbName = ((await queueToggle.textContent()) ?? '').trim();
    expect(climbName).toBeTruthy();
    await expect(page.locator(queueControlBar)).toContainText(climbName);
  });

  test('queue bar should persist with correct climb across tab navigations', async ({ page }) => {
    await page.goto(boardUrl);
    await page
      .waitForSelector('#onboarding-climb-card, [data-testid="climb-card"]', { timeout: 30000 })
      .catch(() => page.waitForLoadState('domcontentloaded'));

    // Add a climb to the queue and capture its name
    const climbCard = page.locator('#onboarding-climb-card');
    await expect(climbCard).toBeVisible({ timeout: 15000 });
    await climbCard.dblclick();

    await expect(page.locator(queueControlBar)).toBeVisible({ timeout: 10000 });
    const queueToggle = page.locator('#onboarding-queue-toggle');
    await expect(queueToggle).toBeVisible({ timeout: 5000 });
    const climbName = ((await queueToggle.textContent()) ?? '').trim();
    expect(climbName).toBeTruthy();

    // Helper to verify queue bar and bottom tab bar on any page
    const verifyBarsShowClimb = async (timeout = 5000) => {
      await expect(page.locator(queueControlBar)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(queueControlBar)).toContainText(climbName, { timeout });
      await expect(page.locator(bottomTabBar)).toBeVisible();
    };

    // Navigate to Home
    await bottomTabButton(page, 'Home').click();
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await verifyBarsShowClimb();

    // Navigate to Discover
    await bottomTabButton(page, 'Discover').click();
    await expect(page).toHaveURL(/\/playlists/, { timeout: 15000 });
    await verifyBarsShowClimb();

    // Navigate to Feed (Notifications tab was removed from the bottom bar;
    // use Feed as a second public route to verify persistence).
    await bottomTabButton(page, 'Feed').click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });
    await verifyBarsShowClimb();

    // Navigate back to Climb
    await bottomTabButton(page, 'Climb', true).click();
    await expect(page).toHaveURL(/\/kilter\//, { timeout: 20000 });
    await verifyBarsShowClimb(15000);
  });
});

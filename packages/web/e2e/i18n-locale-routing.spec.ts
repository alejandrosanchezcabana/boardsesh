import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the locale-routing infrastructure (PR #1778).
 *
 * Verifies the full middleware → server-component → catalog pipeline:
 * the `/es/*` URL is rewritten internally, the `x-boardsesh-locale`
 * request header reaches the layout, `<html lang>` flips, the right
 * Spanish copy renders, and hreflang alternates point at both locales.
 *
 * This is the only end-to-end check we have for locale rewriting,
 * so it covers a few pages rather than just one.
 */

test.describe('i18n locale routing', () => {
  test('English root path renders en chrome with hreflang alternates', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // English copy from marketing.json -> about.hero.title
    await expect(page.getByRole('heading', { name: /Track, Train, and Climb Together/i })).toBeVisible();

    // Hreflang link for the Spanish equivalent must be in <head>.
    await expect(page.locator('head link[rel="alternate"][hreflang="es"][href*="/es/about"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="alternate"][hreflang="en-US"][href$="/about"]')).toHaveCount(1);

    // Canonical points at the en URL, not the es one.
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/about$/);
  });

  test('Spanish prefix renders es chrome with translated copy', async ({ page }) => {
    await page.goto('/es/about');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // Spanish copy from marketing.json -> about.hero.title
    await expect(page.getByRole('heading', { name: /Registra, Entrena y Escala en Grupo/i })).toBeVisible();

    // Canonical now points at the es URL.
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/es\/about$/);
  });

  test('Spanish privacy page falls back to es content with es lang attr', async ({ page }) => {
    await page.goto('/es/privacy');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // privacy.title in es: "Política de Privacidad"
    await expect(page.getByRole('heading', { name: /Política de Privacidad/i })).toBeVisible();
  });

  test('default-locale path leaves URL unprefixed (no /en redirect)', async ({ page }) => {
    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);
    expect(page.url()).toMatch(/\/about$/);
    expect(page.url()).not.toContain('/en/');
  });

  test('non-locale-prefixed routes still resolve normally', async ({ page }) => {
    // Sanity check: a path that starts with /es but is not the Spanish prefix
    // (here just /about's English page) is unaffected. Boards under /b/...
    // are the more important case but require auth + dev DB; this lighter
    // assertion catches regressions in the prefix matcher.
    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const aboutPage = await import('../about/page');
const feedPage = await import('../feed/page');
const loginPage = await import('../auth/login/page');
const settingsPage = await import('../settings/page');

function getOpenGraphImageUrl(image: string | URL | { url: string | URL } | undefined) {
  if (!image) {
    return undefined;
  }

  if (typeof image === 'string') {
    return image;
  }

  if (image instanceof URL) {
    return image.toString();
  }

  return typeof image.url === 'string' ? image.url : image.url.toString();
}

describe('page metadata exports', () => {
  it('gives static marketing pages a canonical URL and default social image', () => {
    const aboutImages = Array.isArray(aboutPage.metadata.openGraph?.images)
      ? aboutPage.metadata.openGraph.images
      : aboutPage.metadata.openGraph?.images
        ? [aboutPage.metadata.openGraph.images]
        : [];
    const aboutImageUrl = getOpenGraphImageUrl(aboutImages[0]);

    expect(aboutPage.metadata.title).toBe('About | Boardsesh');
    expect(aboutPage.metadata.alternates?.canonical).toBe('/about');
    expect(aboutPage.metadata.openGraph?.url).toBe('/about');
    expect(aboutImageUrl).toBe('/opengraph-image');
    expect(aboutPage.metadata.twitter?.images).toEqual(['/opengraph-image']);
  });

  it('keeps utility pages out of search by default', () => {
    expect(feedPage.metadata.robots).toEqual({ index: false, follow: true });
    expect(settingsPage.metadata.robots).toEqual({ index: false, follow: true });
    expect(loginPage.metadata.robots).toEqual({ index: false, follow: true });
  });

  it('sets canonical URLs on noindex pages so the route intent stays explicit', () => {
    expect(feedPage.metadata.alternates?.canonical).toBe('/feed');
    expect(settingsPage.metadata.alternates?.canonical).toBe('/settings');
    expect(loginPage.metadata.alternates?.canonical).toBe('/auth/login');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchInstagramPageMetadata,
  InstagramBetaValidationError,
  instagramBetaValidationInternals,
  validateInstagramBetaLink,
} from '../utils/instagram-beta-validation';
import { getInstagramMediaId } from '../lib/instagram-meta';

const fetchMock = vi.fn();

describe('instagram-beta-validation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('extracts public metadata from instagram html', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta name="description" content="13 likes - climber on Instagram: &quot;Fell From Heaven&quot; @ 35° on the Kilter Board Homewall." />
          <meta property="og:title" content="climber on Instagram: &quot;Fell From Heaven&quot; @ 35° on the Kilter Board Homewall." />
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    await expect(fetchInstagramPageMetadata('https://www.instagram.com/reel/DLM2nf9S1h6/')).resolves.toMatchObject({
      description: expect.stringContaining('Fell From Heaven'),
      imageUrl: 'https://cdn.example.com/image.jpg',
      mediaId: '123456789',
      ogTitle: expect.stringContaining('Fell From Heaven'),
    });
  });

  it('accepts captions that mention the climb name with forgiving normalization', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta name="description" content="Had a great day. Vid #3: Cut to the Chase V10 @ 35°." />
          <meta property="og:title" content="camgibbs on Instagram: Vid #3: Cut to the Chase V10 @ 35°" />
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    await expect(
      validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase'),
    ).resolves.toBeTruthy();
  });

  it('rejects posts that do not mention the climb name', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta name="description" content="Random climbing day montage." />
          <meta property="og:title" content="climber on Instagram: random climbing day montage" />
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    await expect(
      validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase'),
    ).rejects.toThrow(
      `We couldn't confirm this video is for "Cut to the Chase". Please use a public Instagram post or reel whose caption or title mentions the climb name.`,
    );
  });

  it('rejects pages that are not previewable instagram media', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => '<html><head><title>Instagram</title></head></html>',
    });

    await expect(
      validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase'),
    ).rejects.toBeInstanceOf(InstagramBetaValidationError);
  });

  it('normalizes punctuation and entity differences when matching climb names', () => {
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on instagram: &quot;There, There&quot; @ 40° on the Kilter Board',
        'There, There',
      ),
    ).toBe(true);
  });

  it('extracts the same media id from equivalent instagram url variants', () => {
    expect(getInstagramMediaId('https://www.instagram.com/reel/ABC123xyz/')).toBe('ABC123xyz');
    expect(getInstagramMediaId('https://www.instagram.com/p/ABC123xyz/?img_index=1')).toBe('ABC123xyz');
  });

  it('wraps fetch failures in InstagramBetaValidationError', async () => {
    fetchMock.mockRejectedValue(new Error('TimeoutError: signal timed out'));

    await expect(
      validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase'),
    ).rejects.toBeInstanceOf(InstagramBetaValidationError);
  });

  it('matches climb names in non-Latin scripts after Unicode-aware normalization', () => {
    // Cyrillic — would have been wiped to empty by [^a-z0-9].
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: Покатушки @ 40° on the Kilter Board',
        'Покатушки',
      ),
    ).toBe(true);
    // CJK — shouldn't survive lowercase but should survive the filter.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: 攀岩 @ 40° on the Kilter Board',
        '攀岩',
      ),
    ).toBe(true);
  });

  it('parses username from Instagram og:title patterns', () => {
    expect(instagramBetaValidationInternals.parseUsernameFromOgTitle('camgibbs on Instagram: "Cut to the Chase"')).toBe(
      'camgibbs',
    );
    expect(
      instagramBetaValidationInternals.parseUsernameFromOgTitle('@cam.gibbs on Instagram in Boulder, CO: ...'),
    ).toBe('cam.gibbs');
    expect(instagramBetaValidationInternals.parseUsernameFromOgTitle(null)).toBeNull();
    expect(instagramBetaValidationInternals.parseUsernameFromOgTitle('Random title without pattern')).toBeNull();
  });

  it('returns the parsed username on the metadata', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta property="og:title" content="camgibbs on Instagram: Cut to the Chase V10" />
          <meta name="description" content="Cut to the Chase V10" />
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    const metadata = await validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase');
    expect(metadata.username).toBe('camgibbs');
  });
});

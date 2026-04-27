import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchInstagramPageMetadata,
  InstagramBetaValidationError,
  instagramBetaValidationInternals,
  instagramValidationCircuitForTesting,
  validateInstagramBetaLink,
} from '../utils/instagram-beta-validation';
import { getInstagramMediaId } from '../lib/instagram-meta';

const fetchMock = vi.fn();

describe('instagram-beta-validation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    instagramValidationCircuitForTesting.reset();
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

  it('rejects single-word climb names that only appear inside other words', () => {
    // "Gravity" climb shouldn't validate against a post that just mentions
    // "antigravity" — that's the false-positive the ordered-token fallback
    // used to allow.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: antigravity training session',
        'Gravity',
      ),
    ).toBe(false);
    // But the same short name still matches when it appears as a whole word.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: sent Gravity today!',
        'Gravity',
      ),
    ).toBe(true);
  });

  it('parses og:image even when og:title comes first with a long caption', async () => {
    // Regression guard: parseMetaContent's attrRegex used to be a /g regex
    // shared across iterations. After the long og:title tag exhausted the
    // regex's lastIndex, the shorter og:image tag could be silently skipped.
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta property="og:title" content="${'a'.repeat(500)} on Instagram: Cut to the Chase V10 ${'b'.repeat(500)}" />
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
          <meta name="description" content="Cut to the Chase V10" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    await expect(fetchInstagramPageMetadata('https://www.instagram.com/p/CU-NOpdL8Kf/')).resolves.toMatchObject({
      imageUrl: 'https://cdn.example.com/image.jpg',
      mediaId: '123456789',
    });
  });

  it('skips the ordered-token fallback when any token is too short to be distinguishing', () => {
    // "The Project" — "the" is 3 chars. The full phrase doesn't appear as a
    // whole-word substring in this caption, but the tokens "the" and
    // "project" do appear separately in order. Without the min-length guard
    // the fallback would false-positive on any English text.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: the climb after our project debrief was tough',
        'The Project',
      ),
    ).toBe(false);
    // "Power Up" — "up" is 2 chars. Same risk.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: power moves and warming up first',
        'Power Up',
      ),
    ).toBe(false);
    // But the word-bounded substring path still matches when the full phrase
    // appears — we don't gate that path on token length.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: sent The Project today',
        'The Project',
      ),
    ).toBe(true);
  });

  it('still matches multi-word names when every token is long enough', () => {
    // "Fell From Heaven" — all tokens >= 4 chars, fallback kicks in for
    // captions that interleave noise between the climb-name tokens.
    expect(
      instagramBetaValidationInternals.containsNormalizedClimbName(
        'climber on Instagram: fell down from the great heaven yesterday',
        'Fell From Heaven',
      ),
    ).toBe(true);
  });

  it('opens the circuit after enough fetch failures and stops calling out', async () => {
    fetchMock.mockRejectedValue(new Error('TimeoutError'));

    // Trip the circuit. The threshold is 10; drive it past that.
    for (let i = 0; i < 10; i++) {
      await expect(fetchInstagramPageMetadata('https://www.instagram.com/p/CU-NOpdL8Kf/')).rejects.toBeInstanceOf(
        InstagramBetaValidationError,
      );
    }
    expect(instagramValidationCircuitForTesting.isOpen()).toBe(true);
    fetchMock.mockClear();

    // Once open, further calls short-circuit without hitting fetch.
    await expect(fetchInstagramPageMetadata('https://www.instagram.com/p/AnyOther/')).rejects.toBeInstanceOf(
      InstagramBetaValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches climb names with word boundaries via containsAsWord', () => {
    expect(instagramBetaValidationInternals.containsAsWord('sent gravity today', 'gravity')).toBe(true);
    expect(instagramBetaValidationInternals.containsAsWord('gravity is the project', 'gravity')).toBe(true);
    expect(instagramBetaValidationInternals.containsAsWord('the project is gravity', 'gravity')).toBe(true);
    expect(instagramBetaValidationInternals.containsAsWord('gravity', 'gravity')).toBe(true);
    expect(instagramBetaValidationInternals.containsAsWord('antigravity training', 'gravity')).toBe(false);
    expect(instagramBetaValidationInternals.containsAsWord('gravityfall demo', 'gravity')).toBe(false);
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

  it('accepts a public post that mentions the climb name even when og:image is missing', async () => {
    fetchMock.mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      ok: true,
      text: async () => `
        <html><head>
          <meta name="description" content="Cut to the Chase V10 from yesterday's session." />
          <meta property="og:title" content="camgibbs on Instagram: Cut to the Chase V10" />
          <meta property="al:ios:url" content="instagram://media?id=123456789" />
        </head></html>
      `,
    });

    await expect(
      validateInstagramBetaLink('https://www.instagram.com/p/CU-NOpdL8Kf/', 'Cut to the Chase'),
    ).resolves.toMatchObject({ imageUrl: null, mediaId: '123456789' });
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

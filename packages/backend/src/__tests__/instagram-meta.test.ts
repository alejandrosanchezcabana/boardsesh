import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test';
import {
  clearInstagramMetaCache,
  fetchInstagramMeta,
  getInstagramMediaId,
  INSTAGRAM_META_TTL_MS,
  isInstagramUrl,
} from '../lib/instagram-meta';

const SAMPLE_URL = 'https://www.instagram.com/p/ABC123xyz/';

function htmlWithImage(opts: { username?: string | null; src?: string } = {}): string {
  const { username = 'testclimber', src = 'https://scontent.cdninstagram.com/p1080x1080/photo.jpg' } = opts;
  const alt = username ? `Instagram post shared by &#064;${username}` : 'Instagram post';
  return `
    <html><body>
      <img class="EmbeddedMediaImage" alt="${alt}" src="${src}" />
    </body></html>
  `;
}

function htmlWithoutImage(): string {
  return `<html><body><p>No media here</p></body></html>`;
}

function mockFetchOnce(html: string, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(html),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('isInstagramUrl / getInstagramMediaId', () => {
  it('matches canonical post URLs', () => {
    expect(isInstagramUrl('https://www.instagram.com/p/ABC123/')).toBe(true);
    expect(isInstagramUrl('https://instagram.com/reel/XYZ_999/')).toBe(true);
    expect(isInstagramUrl('https://instagr.am/tv/foo-bar/')).toBe(true);
  });

  it('rejects non-Instagram URLs', () => {
    expect(isInstagramUrl('https://tiktok.com/@user/video/123')).toBe(false);
    expect(isInstagramUrl('https://youtube.com/watch?v=abc')).toBe(false);
  });

  it('extracts media id', () => {
    expect(getInstagramMediaId('https://www.instagram.com/p/ABC123/')).toBe('ABC123');
    expect(getInstagramMediaId('not a url')).toBeNull();
  });
});

describe('fetchInstagramMeta', () => {
  beforeEach(() => {
    clearInstagramMetaCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('happy path: parses thumbnail and username from EmbeddedMediaImage', async () => {
    mockFetchOnce(htmlWithImage());
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({
      status: 'ok',
      thumbnail: 'https://scontent.cdninstagram.com/p1080x1080/photo.jpg',
      username: 'testclimber',
    });
  });

  it('returns gone when 200 OK but no embedded image is found', async () => {
    mockFetchOnce(htmlWithoutImage());
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({ status: 'gone' });
  });

  it('maps login-wall 200 to transient_error so we keep the cached thumbnail', async () => {
    mockFetchOnce(`<html><body><a href="/accounts/login">Log in</a></body></html>`);
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({ status: 'transient_error' });
  });

  it('maps rate-limit interstitial to transient_error', async () => {
    mockFetchOnce(`<html><body>Please wait a few minutes before you try again</body></html>`);
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({ status: 'transient_error' });
  });

  it('returns transient_error on non-OK response', async () => {
    mockFetchOnce('', 503);
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({ status: 'transient_error' });
  });

  it('returns transient_error when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchInstagramMeta(SAMPLE_URL);
    expect(result).toEqual({ status: 'transient_error' });
  });

  it('returns gone for malformed (non-Instagram) URLs without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchInstagramMeta('not a real url');
    expect(result).toEqual({ status: 'gone' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches successful results within TTL (one fetch for two calls)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(htmlWithImage()),
    });
    vi.stubGlobal('fetch', fetchMock);

    const a = await fetchInstagramMeta(SAMPLE_URL);
    const b = await fetchInstagramMeta(SAMPLE_URL);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent calls for the same URL', async () => {
    let resolveBody!: (v: string) => void;
    const bodyPromise = new Promise<string>((resolve) => {
      resolveBody = resolve;
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => bodyPromise,
    });
    vi.stubGlobal('fetch', fetchMock);

    const p1 = fetchInstagramMeta(SAMPLE_URL);
    const p2 = fetchInstagramMeta(SAMPLE_URL);
    resolveBody(htmlWithImage());

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache transient_error (refetches on next call)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(htmlWithImage()) });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchInstagramMeta(SAMPLE_URL);
    const second = await fetchInstagramMeta(SAMPLE_URL);

    expect(first).toEqual({ status: 'transient_error' });
    expect(second.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches after the cache TTL expires', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(htmlWithImage()),
    });
    vi.stubGlobal('fetch', fetchMock);

    const start = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(start);

    await fetchInstagramMeta(SAMPLE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dateSpy.mockReturnValue(start + INSTAGRAM_META_TTL_MS + 1);
    await fetchInstagramMeta(SAMPLE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });
});

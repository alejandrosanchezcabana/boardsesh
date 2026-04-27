import { describe, it, expect } from 'vite-plus/test';
import { getTikTokVideoId, isTikTokUrl } from '../tiktok-url';

describe('isTikTokUrl', () => {
  it('accepts long-form video URLs', () => {
    expect(isTikTokUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')).toBe(true);
    expect(isTikTokUrl('https://tiktok.com/@a/video/123')).toBe(true);
    expect(isTikTokUrl('https://m.tiktok.com/@a/video/123')).toBe(true);
    expect(isTikTokUrl('HTTPS://www.tiktok.com/@A/video/1')).toBe(true);
  });

  it('accepts short-link variants', () => {
    expect(isTikTokUrl('https://vm.tiktok.com/ZSL4xXWxR/')).toBe(true);
    expect(isTikTokUrl('https://vt.tiktok.com/ZSL4xXWxR/')).toBe(true);
    expect(isTikTokUrl('https://t.tiktok.com/abc')).toBe(true);
  });

  it('rejects non-tiktok hosts and lookalikes', () => {
    expect(isTikTokUrl('https://www.instagram.com/reel/ABC/')).toBe(false);
    expect(isTikTokUrl('https://nottiktok.com/@a/video/1')).toBe(false);
    expect(isTikTokUrl('https://evil.com?ref=tiktok.com/@a/video/1')).toBe(false);
    expect(isTikTokUrl('tiktok.com/@a/video/1')).toBe(false);
    expect(isTikTokUrl('just some text')).toBe(false);
  });
});

describe('getTikTokVideoId', () => {
  it('extracts numeric id from long-form URLs', () => {
    expect(getTikTokVideoId('https://www.tiktok.com/@scout2015/video/6718335390845095173')).toBe('6718335390845095173');
    expect(getTikTokVideoId('https://tiktok.com/@a/video/42?foo=bar')).toBe('42');
  });

  it('returns null for short-link forms', () => {
    expect(getTikTokVideoId('https://vm.tiktok.com/ZSL4xXWxR/')).toBeNull();
    expect(getTikTokVideoId('https://vt.tiktok.com/abc')).toBeNull();
  });

  it('returns null for non-tiktok URLs', () => {
    expect(getTikTokVideoId('https://www.instagram.com/reel/ABC/')).toBeNull();
  });
});

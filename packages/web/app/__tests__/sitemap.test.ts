import { describe, it, expect } from 'vitest';
import sitemap from '../sitemap';

describe('sitemap', () => {
  it('includes the homepage with highest priority', () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url === 'https://www.boardsesh.com');
    expect(home).toBeDefined();
    expect(home!.priority).toBe(1.0);
  });

  it('includes about, help, docs, and playlists pages', () => {
    const result = sitemap();
    const urls = result.map((entry) => entry.url);
    expect(urls).toContain('https://www.boardsesh.com/about');
    expect(urls).toContain('https://www.boardsesh.com/help');
    expect(urls).toContain('https://www.boardsesh.com/docs');
    expect(urls).toContain('https://www.boardsesh.com/playlists');
  });

  it('does not include /feed or /auth paths', () => {
    const result = sitemap();
    const urls = result.map((entry) => entry.url);
    const hasFeed = urls.some((url) => url.includes('/feed'));
    const hasAuth = urls.some((url) => url.includes('/auth'));
    expect(hasFeed).toBe(false);
    expect(hasAuth).toBe(false);
  });

  it('sets lastModified on all entries', () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});

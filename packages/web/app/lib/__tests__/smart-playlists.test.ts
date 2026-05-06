import { describe, it, expect } from 'vite-plus/test';
import { SMART_PLAYLISTS, smartPlaylistBySlug, smartPlaylistByType, smartPlaylistHref } from '../smart-playlists';

describe('smartPlaylistBySlug', () => {
  it('returns the preset for each known slug', () => {
    expect(smartPlaylistBySlug('five-stars')?.type).toBe('FIVE_STARS');
    expect(smartPlaylistBySlug('most-repeated')?.type).toBe('MOST_REPEATED');
    expect(smartPlaylistBySlug('projects')?.type).toBe('PROJECTS');
  });

  it('returns undefined for an unknown slug', () => {
    expect(smartPlaylistBySlug('not-a-real-slug')).toBeUndefined();
    expect(smartPlaylistBySlug('')).toBeUndefined();
  });

  it('exposes the i18n keys, icon, and color for a known slug', () => {
    const fiveStars = smartPlaylistBySlug('five-stars');
    expect(fiveStars).toBeDefined();
    expect(fiveStars?.titleI18nKey).toBe('library.smart.fiveStars.title');
    expect(fiveStars?.descriptionI18nKey).toBe('library.smart.fiveStars.description');
    expect(fiveStars?.icon).toBe('⭐');
    expect(typeof fiveStars?.color).toBe('string');
    expect(fiveStars?.color.length).toBeGreaterThan(0);
  });
});

describe('smartPlaylistByType', () => {
  it('returns the preset for each known type', () => {
    expect(smartPlaylistByType('FIVE_STARS').slug).toBe('five-stars');
    expect(smartPlaylistByType('MOST_REPEATED').slug).toBe('most-repeated');
    expect(smartPlaylistByType('PROJECTS').slug).toBe('projects');
  });

  it('throws on an unknown type so callers cannot silently render nothing', () => {
    // The route page already gates by slug → preset before reaching this
    // helper, so a thrown error here would surface as a 500 — which is
    // exactly what we want if a new type is added in the schema without
    // a matching presentation entry. Pin that contract.
    expect(() => smartPlaylistByType('UNKNOWN' as never)).toThrow(/Unknown smart playlist type/);
    expect(() => smartPlaylistByType('UNKNOWN' as never)).toThrow(/UNKNOWN/);
  });

  it('every entry in SMART_PLAYLISTS is reachable by its type', () => {
    for (const preset of SMART_PLAYLISTS) {
      expect(smartPlaylistByType(preset.type)).toBe(preset);
    }
  });
});

describe('smartPlaylistHref', () => {
  it('formats /discover/<slug>/<userId>', () => {
    expect(smartPlaylistHref('five-stars', 'user-123')).toBe('/discover/five-stars/user-123');
    expect(smartPlaylistHref('projects', 'abc')).toBe('/discover/projects/abc');
  });

  it('encodes special characters in the userId segment', () => {
    expect(smartPlaylistHref('most-repeated', 'name with spaces')).toBe('/discover/most-repeated/name%20with%20spaces');
    expect(smartPlaylistHref('most-repeated', 'a/b/c')).toBe('/discover/most-repeated/a%2Fb%2Fc');
    expect(smartPlaylistHref('most-repeated', 'climber@example.com')).toBe(
      '/discover/most-repeated/climber%40example.com',
    );
  });
});

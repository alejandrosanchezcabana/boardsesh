import { describe, expect, it } from 'vitest';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import { dedupeBetaLinks, getInstagramEmbedUrl, getInstagramMediaId } from '../instagram-url';

function makeBetaLink(overrides: Partial<BetaLink>): BetaLink {
  return {
    climb_uuid: 'climb-1',
    link: 'https://www.instagram.com/reel/ABC123xyz/',
    foreign_username: null,
    angle: null,
    thumbnail: null,
    is_listed: true,
    created_at: '2026-04-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('instagram-url', () => {
  it('extracts the Instagram media id from post and reel links', () => {
    expect(getInstagramMediaId('https://www.instagram.com/reel/DJ5Cw5OIS82/')).toBe('DJ5Cw5OIS82');
    expect(getInstagramMediaId('https://www.instagram.com/p/DEdQNTzScjp/?img_index=1')).toBe('DEdQNTzScjp');
  });

  it('builds embed URLs from the extracted media id', () => {
    expect(getInstagramEmbedUrl('https://www.instagram.com/reel/DJ5Cw5OIS82/')).toBe(
      'https://www.instagram.com/p/DJ5Cw5OIS82/embed',
    );
  });

  it('dedupes beta links that point to the same Instagram media and preserves richer metadata', () => {
    const deduped = dedupeBetaLinks([
      makeBetaLink({
        link: 'https://www.instagram.com/reel/DJ5Cw5OIS82/',
        foreign_username: null,
        angle: null,
        thumbnail: null,
      }),
      makeBetaLink({
        link: 'https://www.instagram.com/p/DJ5Cw5OIS82/?img_index=1',
        foreign_username: 'climber',
        angle: 35,
        thumbnail: 'https://cdn.example.com/thumb.jpg',
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.foreign_username).toBe('climber');
    expect(deduped[0]?.angle).toBe(35);
    expect(deduped[0]?.thumbnail).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('keeps distinct Instagram media as separate videos', () => {
    const deduped = dedupeBetaLinks([
      makeBetaLink({ link: 'https://www.instagram.com/reel/FIRST123/' }),
      makeBetaLink({ link: 'https://www.instagram.com/reel/SECOND456/' }),
    ]);

    expect(deduped).toHaveLength(2);
  });
});

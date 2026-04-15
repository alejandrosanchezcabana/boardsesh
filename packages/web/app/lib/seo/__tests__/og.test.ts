import { describe, expect, it } from 'vitest';
import { buildOgVersionToken, buildVersionedOgImagePath, createOgImageHeaders } from '../og';

describe('buildOgVersionToken', () => {
  it('uses the latest timestamp across multiple inputs', () => {
    const version = buildOgVersionToken('2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z');

    expect(version).toBe(new Date('2024-01-02T00:00:00.000Z').getTime().toString(36));
  });

  it('falls back to zero when no timestamps are available', () => {
    expect(buildOgVersionToken(null, undefined)).toBe('0');
  });
});

describe('buildVersionedOgImagePath', () => {
  it('appends the version token to the query string', () => {
    const path = buildVersionedOgImagePath('/api/og/profile', { user_id: 'user-123' }, 'abc123');

    expect(path).toBe('/api/og/profile?user_id=user-123&v=abc123');
  });
});

describe('createOgImageHeaders', () => {
  it('returns immutable headers for versioned requests', () => {
    const headers = createOgImageHeaders({ contentType: 'image/png', version: 'abc123' }) as Record<string, string>;

    expect(headers['Content-Type']).toBe('image/png');
    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['CDN-Cache-Control']).toContain('immutable');
    expect(headers['Vercel-CDN-Cache-Control']).toContain('immutable');
  });

  it('returns short-lived headers for unversioned requests', () => {
    const headers = createOgImageHeaders({ contentType: 'image/png' }) as Record<string, string>;

    expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
    expect(headers['CDN-Cache-Control']).toContain('s-maxage=300');
  });
});

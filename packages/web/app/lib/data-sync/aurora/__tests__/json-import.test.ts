import { describe, it, expect, vi } from 'vitest';

// Mock server-only and DB modules to avoid server-component import errors
vi.mock('server-only', () => ({}));
vi.mock('@/app/lib/db/db', () => ({
  getDb: vi.fn(),
  getPool: vi.fn(),
}));
vi.mock('@/app/lib/db/schema', () => ({
  boardseshTicks: {},
  boardClimbs: { uuid: 'uuid', name: 'name', boardType: 'board_type', isListed: 'is_listed', isDraft: 'is_draft' },
  boardClimbStats: { climbUuid: 'climb_uuid', boardType: 'board_type', ascensionistCount: 'ascensionist_count' },
  playlists: {},
  playlistClimbs: {},
  playlistOwnership: {},
  inferredSessions: {},
}));

import {
  auroraExportSchema,
  normalizeTimestamp,
  generateJsonImportAuroraId,
} from '../json-import';

// ---------------------------------------------------------------------------
// normalizeTimestamp
// ---------------------------------------------------------------------------

describe('normalizeTimestamp', () => {
  it('normalizes Aurora API format (no T, no Z) to ISO', () => {
    expect(normalizeTimestamp('2024-01-15 10:30:00')).toBe('2024-01-15T10:30:00.000Z');
  });

  it('normalizes ISO format to itself', () => {
    expect(normalizeTimestamp('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z');
  });

  it('normalizes Aurora export format with microseconds', () => {
    const result = normalizeTimestamp('2025-01-01 01:01:01.000001');
    expect(result).toBe('2025-01-01T01:01:01.000Z');
  });

  it('produces the same output for equivalent timestamps in different formats', () => {
    const fromDb = normalizeTimestamp('2024-01-15 10:30:00');
    const fromImport = normalizeTimestamp('2024-01-15T10:30:00.000Z');
    expect(fromDb).toBe(fromImport);
  });

  it('handles dates with timezone offsets', () => {
    const result = normalizeTimestamp('2024-01-15T10:30:00+02:00');
    expect(result).toBe('2024-01-15T08:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// generateJsonImportAuroraId
// ---------------------------------------------------------------------------

describe('generateJsonImportAuroraId', () => {
  it('produces deterministic IDs for same inputs', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different climb UUIDs', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-2', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for different angles', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-1', 45, '2024-01-15T10:00:00.000Z', 'ascents');
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for different timestamps', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T11:00:00.000Z', 'ascents');
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for ascents vs bids', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'bids');
    expect(id1).not.toBe(id2);
  });

  it('starts with json-import- prefix', () => {
    const id = generateJsonImportAuroraId('uuid-1', 40, '2024-01-15T10:00:00.000Z', 'ascents');
    expect(id).toMatch(/^json-import-[0-9a-f]{32}$/);
  });
});

// ---------------------------------------------------------------------------
// auroraExportSchema validation
// ---------------------------------------------------------------------------

describe('auroraExportSchema', () => {
  const minimalExport = {
    user: { username: 'testuser' },
  };

  it('accepts a minimal export with only user field', () => {
    const result = auroraExportSchema.safeParse(minimalExport);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ascents).toEqual([]);
      expect(result.data.attempts).toEqual([]);
      expect(result.data.circuits).toEqual([]);
    }
  });

  it('accepts a full export with all fields', () => {
    const full = {
      user: { username: 'testuser', email_address: 'test@example.com', created_at: '2024-01-01' },
      ascents: [{
        climb: 'Test Climb',
        angle: 40,
        count: 1,
        stars: 3,
        climbed_at: '2024-01-15 10:00:00',
        created_at: '2024-01-15 10:00:00',
        grade: '6c',
      }],
      attempts: [{
        climb: 'Hard Climb',
        angle: 45,
        count: 3,
        climbed_at: '2024-01-15 11:00:00',
        created_at: '2024-01-15 11:00:00',
      }],
      circuits: [{
        name: 'My Circuit',
        color: 'FF00FF',
        created_at: '2024-01-01',
        climbs: ['Climb A', 'Climb B'],
      }],
      likes: [{ climb: 'Liked Climb', created_at: '2024-01-01' }],
      follows: [{ some: 'data' }],
      walls: [],
      blocks: [],
      beta_links: [],
      climbs: [{ name: 'My Climb', layout: 'Kilter Board Original' }],
      agreements: [{ name: 'privacy_policy' }],
    };

    const result = auroraExportSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ascents).toHaveLength(1);
      expect(result.data.attempts).toHaveLength(1);
      expect(result.data.circuits).toHaveLength(1);
      expect(result.data.likes).toHaveLength(1);
    }
  });

  it('rejects export without user.username', () => {
    const result = auroraExportSchema.safeParse({ user: {} });
    expect(result.success).toBe(false);
  });

  it('rejects ascent missing required fields', () => {
    const result = auroraExportSchema.safeParse({
      user: { username: 'test' },
      ascents: [{ climb: 'Test', angle: 40 }], // missing count, stars, climbed_at, created_at, grade
    });
    expect(result.success).toBe(false);
  });

  it('rejects attempt missing required fields', () => {
    const result = auroraExportSchema.safeParse({
      user: { username: 'test' },
      attempts: [{ climb: 'Test' }], // missing angle, count, climbed_at, created_at
    });
    expect(result.success).toBe(false);
  });

  it('defaults arrays to empty when not present', () => {
    const result = auroraExportSchema.safeParse({ user: { username: 'test' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ascents).toEqual([]);
      expect(result.data.attempts).toEqual([]);
      expect(result.data.circuits).toEqual([]);
      expect(result.data.likes).toEqual([]);
    }
  });

  it('accepts export with empty arrays', () => {
    const result = auroraExportSchema.safeParse({
      user: { username: 'test' },
      ascents: [],
      attempts: [],
      circuits: [],
      likes: [],
    });
    expect(result.success).toBe(true);
  });

  it('ignores extra unknown fields in the export', () => {
    const result = auroraExportSchema.safeParse({
      user: { username: 'test' },
      some_future_field: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dedup key consistency (integration-style unit test)
// ---------------------------------------------------------------------------

describe('dedup key consistency', () => {
  it('generates matching keys for same timestamp in different formats', () => {
    // This tests the exact scenario that was a bug: DB returns one format,
    // import code uses another, and they must match for dedup to work.
    const dbTimestamp = '2024-01-15 10:30:00'; // What Drizzle returns
    const importTimestamp = '2024-01-15T10:30:00.000Z'; // What new Date().toISOString() produces

    const dbNormalized = normalizeTimestamp(dbTimestamp);
    const importNormalized = normalizeTimestamp(importTimestamp);

    expect(dbNormalized).toBe(importNormalized);

    // Build keys as the actual code would
    const climbUuid = 'abc-123';
    const angle = 40;
    const dbKey = `${climbUuid}:${angle}:${dbNormalized}`;
    const importKey = `${climbUuid}:${angle}:${importNormalized}`;
    expect(dbKey).toBe(importKey);
  });

  it('generates matching keys for Aurora export format with microseconds', () => {
    const exportTimestamp = '2025-01-01 01:01:01.000001'; // Aurora export format
    const isoTimestamp = '2025-01-01T01:01:01.000Z';

    expect(normalizeTimestamp(exportTimestamp)).toBe(normalizeTimestamp(isoTimestamp));
  });

  it('auroraId is consistent regardless of input timestamp format', () => {
    const id1 = generateJsonImportAuroraId('uuid-1', 40, normalizeTimestamp('2024-01-15 10:30:00'), 'ascents');
    const id2 = generateJsonImportAuroraId('uuid-1', 40, normalizeTimestamp('2024-01-15T10:30:00.000Z'), 'ascents');
    expect(id1).toBe(id2);
  });
});

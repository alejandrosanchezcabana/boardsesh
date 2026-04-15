import { describe, it, expect } from 'vitest';
import { buildGradeDistributionFromTicks, computeSessionAggregates } from '../graphql/resolvers/social/session-feed-utils';

describe('computeSessionAggregates', () => {
  it('counts flashes as both flashes and sends', () => {
    const result = computeSessionAggregates([
      { tick: { status: 'flash', attemptCount: 1 } },
    ]);
    expect(result).toEqual({ totalSends: 1, totalFlashes: 1, totalAttempts: 0 });
  });

  it('counts sends and their implicit failed attempts', () => {
    const result = computeSessionAggregates([
      { tick: { status: 'send', attemptCount: 5 } },
    ]);
    expect(result).toEqual({ totalSends: 1, totalFlashes: 0, totalAttempts: 4 });
  });

  it('counts attempt ticks', () => {
    const result = computeSessionAggregates([
      { tick: { status: 'attempt', attemptCount: 3 } },
    ]);
    expect(result).toEqual({ totalSends: 0, totalFlashes: 0, totalAttempts: 3 });
  });

  it('aggregates mixed statuses', () => {
    const result = computeSessionAggregates([
      { tick: { status: 'flash', attemptCount: 1 } },
      { tick: { status: 'send', attemptCount: 3 } },
      { tick: { status: 'attempt', attemptCount: 2 } },
    ]);
    expect(result).toEqual({ totalSends: 2, totalFlashes: 1, totalAttempts: 4 });
  });
});

describe('buildGradeDistributionFromTicks', () => {
  it('builds distribution from ticks with explicit difficulty', () => {
    const result = buildGradeDistributionFromTicks([
      { tick: { status: 'flash', difficulty: 20, boardType: 'kilter', attemptCount: 1 }, difficultyName: '6c/V5' },
      { tick: { status: 'send', difficulty: 20, boardType: 'kilter', attemptCount: 3 }, difficultyName: '6c/V5' },
      { tick: { status: 'flash', difficulty: 22, boardType: 'kilter', attemptCount: 1 }, difficultyName: '7a/V6' },
    ]);

    expect(result).toHaveLength(2);
    // Sorted hardest-first
    expect(result[0]).toEqual({ grade: '7a/V6', flash: 1, send: 0, attempt: 0 });
    expect(result[1]).toEqual({ grade: '6c/V5', flash: 1, send: 1, attempt: 2 });
  });

  it('skips ticks with no difficulty and no consensus fallback', () => {
    const result = buildGradeDistributionFromTicks([
      { tick: { status: 'flash', difficulty: null, boardType: 'kilter', attemptCount: 1 }, difficultyName: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it('uses consensus difficulty when tick difficulty is null', () => {
    const result = buildGradeDistributionFromTicks([
      {
        tick: { status: 'send', difficulty: null, boardType: 'kilter', attemptCount: 2 },
        difficultyName: null,
        consensusDifficulty: 20.3,
      },
    ]);

    expect(result).toHaveLength(1);
    // ROUND(20.3) = 20 → '6c/V5'
    expect(result[0]).toEqual({ grade: '6c/V5', flash: 0, send: 1, attempt: 1 });
  });

  it('rounds consensus difficulty to nearest integer', () => {
    const result = buildGradeDistributionFromTicks([
      {
        tick: { status: 'flash', difficulty: null, boardType: 'kilter', attemptCount: 1 },
        difficultyName: null,
        consensusDifficulty: 21.7,
      },
    ]);

    expect(result).toHaveLength(1);
    // ROUND(21.7) = 22 → '7a/V6'
    expect(result[0]).toEqual({ grade: '7a/V6', flash: 1, send: 0, attempt: 0 });
  });

  it('prefers tick difficulty over consensus difficulty', () => {
    const result = buildGradeDistributionFromTicks([
      {
        tick: { status: 'send', difficulty: 22, boardType: 'kilter', attemptCount: 1 },
        difficultyName: '7a/V6',
        consensusDifficulty: 20.0,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].grade).toBe('7a/V6');
  });

  it('groups ticks with same effective difficulty from mixed sources', () => {
    const result = buildGradeDistributionFromTicks([
      // Tick with explicit difficulty
      { tick: { status: 'flash', difficulty: 20, boardType: 'kilter', attemptCount: 1 }, difficultyName: '6c/V5' },
      // Tick falling back to consensus (rounds to same grade)
      {
        tick: { status: 'send', difficulty: null, boardType: 'kilter', attemptCount: 2 },
        difficultyName: null,
        consensusDifficulty: 20.1,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ grade: '6c/V5', flash: 1, send: 1, attempt: 1 });
  });

  it('includes attempt ticks when they have consensus difficulty', () => {
    const result = buildGradeDistributionFromTicks([
      {
        tick: { status: 'attempt', difficulty: null, boardType: 'kilter', attemptCount: 3 },
        difficultyName: null,
        consensusDifficulty: 25.0,
      },
    ]);

    expect(result).toHaveLength(1);
    // 25 → '7b+/V8'
    expect(result[0]).toEqual({ grade: '7b+/V8', flash: 0, send: 0, attempt: 3 });
  });

  it('handles empty input', () => {
    const result = buildGradeDistributionFromTicks([]);
    expect(result).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vite-plus/test';
import { classifyClimbListChange, stabilizeClimbArrayRef } from '../climb-list-utils';
import type { Climb } from '@/app/lib/types';

function makeClimb(uuid: string): Climb {
  return {
    uuid,
    setter_username: 'user',
    name: `Climb ${uuid}`,
    frames: '',
    angle: 40,
    ascensionist_count: 0,
    difficulty: 'V3',
    quality_average: '3.0',
    stars: 3,
    difficulty_error: '0',
    benchmark_difficulty: null,
  };
}

describe('classifyClimbListChange', () => {
  const climbA = makeClimb('a');
  const climbB = makeClimb('b');
  const climbC = makeClimb('c');
  const climbD = makeClimb('d');

  it('returns "same" for identical content with different references', () => {
    const prev = [climbA, climbB, climbC];
    const current = [...prev]; // new array, same items
    expect(classifyClimbListChange(current, prev)).toBe('same');
  });

  it('returns "same" for two empty arrays', () => {
    expect(classifyClimbListChange([], [])).toBe('same');
  });

  it('returns "same" for single-item lists with same UUID', () => {
    const prev = [climbA];
    const current = [{ ...climbA }];
    expect(classifyClimbListChange(current, prev)).toBe('same');
  });

  it('returns "append" when items are added to the end', () => {
    const prev = [climbA, climbB];
    const current = [climbA, climbB, climbC, climbD];
    expect(classifyClimbListChange(current, prev)).toBe('append');
  });

  it('returns "replace" for completely different data', () => {
    const prev = [climbA, climbB];
    const current = [climbC, climbD];
    expect(classifyClimbListChange(current, prev)).toBe('replace');
  });

  it('returns "replace" when same length but different first item', () => {
    const prev = [climbA, climbB];
    const current = [climbC, climbD];
    expect(classifyClimbListChange(current, prev)).toBe('replace');
  });

  it('returns "replace" when same length and first item but different last item', () => {
    const prev = [climbA, climbB];
    const current = [climbA, climbC];
    expect(classifyClimbListChange(current, prev)).toBe('replace');
  });

  it('returns "replace" when going from non-empty to empty', () => {
    const prev = [climbA, climbB];
    expect(classifyClimbListChange([], prev)).toBe('replace');
  });

  it('returns "replace" when going from empty to non-empty', () => {
    const current = [climbA, climbB];
    expect(classifyClimbListChange(current, [])).toBe('replace');
  });

  it('returns "append" not "replace" when list grows with same first item', () => {
    const prev = [climbA];
    const current = [climbA, climbB];
    expect(classifyClimbListChange(current, prev)).toBe('append');
  });

  it('returns "replace" when list grows but first item differs', () => {
    const prev = [climbA];
    const current = [climbB, climbC];
    expect(classifyClimbListChange(current, prev)).toBe('replace');
  });

  it('returns "replace" when list shrinks with same first item (re-search with fewer results)', () => {
    const prev = [climbA, climbB, climbC];
    const current = [climbA, climbB];
    expect(classifyClimbListChange(current, prev)).toBe('replace');
  });
});

describe('stabilizeClimbArrayRef', () => {
  const climbA = makeClimb('a');
  const climbB = makeClimb('b');
  const climbC = makeClimb('c');

  it('returns previous reference when content matches', () => {
    const prev = [climbA, climbB, climbC];
    const current = [...prev];
    const result = stabilizeClimbArrayRef(current, prev);
    expect(result).toBe(prev); // same reference
    expect(result).not.toBe(current);
  });

  it('returns previous reference for empty arrays', () => {
    const prev: Climb[] = [];
    const current: Climb[] = [];
    expect(stabilizeClimbArrayRef(current, prev)).toBe(prev);
  });

  it('returns current when content differs', () => {
    const prev = [climbA, climbB];
    const current = [climbA, climbC];
    expect(stabilizeClimbArrayRef(current, prev)).toBe(current);
  });

  it('returns current when lengths differ', () => {
    const prev = [climbA, climbB];
    const current = [climbA, climbB, climbC];
    expect(stabilizeClimbArrayRef(current, prev)).toBe(current);
  });

  it('returns current for single item that differs', () => {
    const prev = [climbA];
    const current = [climbB];
    expect(stabilizeClimbArrayRef(current, prev)).toBe(current);
  });
});

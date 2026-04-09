import { describe, expect, it } from 'vitest';
import { SUPPORTED_BOARDS } from '@boardsesh/shared-schema';
import { BoardNameSchema } from '../validation/schemas';

describe('BoardNameSchema', () => {
  it('accepts every shared supported board', () => {
    for (const boardName of SUPPORTED_BOARDS) {
      expect(BoardNameSchema.parse(boardName)).toBe(boardName);
    }
  });

  it('rejects unsupported board names with the shared error message', () => {
    const result = BoardNameSchema.safeParse('invalid-board');
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(`Board name must be ${SUPPORTED_BOARDS.join(', ')}`);
    }
  });
});

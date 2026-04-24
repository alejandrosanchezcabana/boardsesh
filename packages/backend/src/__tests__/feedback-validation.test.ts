import { describe, it, expect } from 'vite-plus/test';
import { SubmitAppFeedbackInputSchema } from '../validation/schemas';

describe('SubmitAppFeedbackInputSchema', () => {
  const BASE = {
    platform: 'web' as const,
    appVersion: '1.0.0',
  };

  describe('rating sources', () => {
    it('accepts a valid rating + comment submission', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        rating: 4,
        comment: 'Nice',
        source: 'drawer-feedback',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a rating submission with no comment', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        rating: 5,
        source: 'prompt',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a rating submission without a rating', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        source: 'prompt',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an out-of-range rating', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        rating: 7,
        source: 'drawer-feedback',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bug sources', () => {
    it('accepts a bug report with no rating and a ≥10-char comment', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        comment: 'Crashed on submit',
        source: 'shake-bug',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rating ?? null).toBeNull();
      }
    });

    it('accepts drawer-bug source same as shake-bug', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        comment: 'Screen went blank',
        source: 'drawer-bug',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a bug report without a comment', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        source: 'shake-bug',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a bug report with a too-short comment', () => {
      const result = SubmitAppFeedbackInputSchema.safeParse({
        ...BASE,
        comment: 'short',
        source: 'shake-bug',
      });
      expect(result.success).toBe(false);
    });
  });

  it('rejects an unknown source', () => {
    const result = SubmitAppFeedbackInputSchema.safeParse({
      ...BASE,
      rating: 5,
      source: 'bogus',
    });
    expect(result.success).toBe(false);
  });
});

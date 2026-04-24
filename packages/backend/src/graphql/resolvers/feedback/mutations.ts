import type { ConnectionContext } from '@boardsesh/shared-schema';
import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { applyRateLimit, validateInput } from '../shared/helpers';
import { SubmitAppFeedbackInputSchema } from '../../../validation/schemas';
import { postFeedbackToDiscord } from '../../../services/discord';

export const feedbackMutations = {
  submitAppFeedback: async (_: unknown, { input }: { input: unknown }, ctx: ConnectionContext): Promise<boolean> => {
    await applyRateLimit(ctx, 10, 'submitAppFeedback');

    const validated = validateInput(SubmitAppFeedbackInputSchema, input, 'input');
    const comment = validated.comment?.trim() ? validated.comment.trim() : null;
    const appVersion = validated.appVersion ?? null;
    const rating = validated.rating ?? null;

    const [row] = await db
      .insert(dbSchema.appFeedback)
      .values({
        userId: ctx.userId ?? null,
        rating,
        comment,
        platform: validated.platform,
        appVersion,
        source: validated.source,
      })
      .returning();

    // Fire-and-forget. postFeedbackToDiscord swallows all errors internally.
    void postFeedbackToDiscord({
      feedbackId: row.id,
      rating,
      comment,
      platform: validated.platform,
      appVersion,
      source: validated.source,
    });

    return true;
  },
};

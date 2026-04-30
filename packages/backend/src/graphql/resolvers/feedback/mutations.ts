import type { ConnectionContext, FeedbackContextInput } from '@boardsesh/shared-schema';
import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import type { FeedbackContext } from '@boardsesh/db/schema';
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
    const boardName = validated.boardName ?? null;
    const layoutId = validated.layoutId ?? null;
    const sizeId = validated.sizeId ?? null;
    const setIds = validated.setIds ?? null;
    const angle = validated.angle ?? null;
    const context = normalizeContext(validated.context);

    const rows = await db
      .insert(dbSchema.appFeedback)
      .values({
        userId: ctx.userId ?? null,
        rating,
        comment,
        platform: validated.platform,
        appVersion,
        source: validated.source,
        boardName,
        layoutId,
        sizeId,
        setIds,
        angle,
        context,
      })
      .returning();
    const row = rows[0];

    // Fire-and-forget. postFeedbackToDiscord swallows all errors internally.
    // Guard on row existence — an insert that doesn't return a row means
    // something's wrong at the DB layer (not our contract), so skip the
    // side-effect rather than crash the mutation.
    if (row) {
      void postFeedbackToDiscord({
        feedbackId: row.id,
        rating,
        comment,
        platform: validated.platform,
        appVersion,
        source: validated.source,
        boardName,
        layoutId,
        sizeId,
        setIds,
        angle,
        context,
      });
    }

    return true;
  },
};

// Drop null/undefined leaves and return null when the result is empty so we
// don't write `{}` rows that look like "context was provided but blank". The
// stored shape uses `string | undefined` (no nulls) — narrower than the
// nullable input type — so we return `FeedbackContext` to match the column.
function normalizeContext(input: FeedbackContextInput | null | undefined): FeedbackContext | null {
  if (!input) return null;
  const out: FeedbackContext = {};
  for (const [k, v] of Object.entries(input) as Array<[keyof FeedbackContext, unknown]>) {
    if (typeof v === 'string' && v.length > 0) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

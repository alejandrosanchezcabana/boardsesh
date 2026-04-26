import type { ConnectionContext } from '@boardsesh/shared-schema';
import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuthenticated, validateInput, applyRateLimit } from '../shared/helpers';
import { CreateBetaVideoInputSchema } from '../../../validation/schemas/beta-videos';
import {
  isBunnyStreamConfigured,
  createBunnyVideo,
  getTusUploadCredentials,
  deleteBunnyVideo,
} from '../../../lib/bunny-stream';

export const betaVideoMutations = {
  createBetaVideo: async (
    _: unknown,
    { input }: { input: unknown },
    ctx: ConnectionContext,
  ): Promise<{
    uuid: string;
    uploadUrl: string;
    authorizationSignature: string;
    authorizationExpire: number;
    videoId: string;
    libraryId: string;
  }> => {
    requireAuthenticated(ctx);
    await applyRateLimit(ctx, 10, 'createBetaVideo');

    if (!isBunnyStreamConfigured()) {
      throw new Error('Beta video uploads are not configured');
    }

    const validated = validateInput(CreateBetaVideoInputSchema, input, 'input');

    // Create video in Bunny Stream
    const bunnyVideo = await createBunnyVideo(validated.title ?? `Beta for ${validated.climbUuid}`);

    // Generate UUID for our record
    const uuid = crypto.randomUUID();
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID!;

    // Insert DB record — clean up Bunny video if DB insert fails
    try {
      await db.insert(dbSchema.boardseshBetaVideos).values({
        uuid,
        userId: ctx.userId!,
        boardType: validated.boardType,
        climbUuid: validated.climbUuid,
        angle: validated.angle ?? null,
        bunnyVideoId: bunnyVideo.guid,
        bunnyLibraryId: libraryId,
        title: validated.title ?? null,
        status: 'processing',
      });
    } catch (dbError) {
      // Best-effort cleanup of the orphaned Bunny video
      try {
        await deleteBunnyVideo(bunnyVideo.guid);
      } catch {
        /* best effort */
      }
      throw dbError;
    }

    // Get TUS upload credentials for the client
    const tusCredentials = await getTusUploadCredentials(bunnyVideo.guid);

    return {
      uuid,
      ...tusCredentials,
    };
  },

  deleteBetaVideo: async (_: unknown, { uuid }: { uuid: string }, ctx: ConnectionContext): Promise<boolean> => {
    requireAuthenticated(ctx);

    const [video] = await db
      .select()
      .from(dbSchema.boardseshBetaVideos)
      .where(eq(dbSchema.boardseshBetaVideos.uuid, uuid))
      .limit(1);

    if (!video) {
      throw new Error('Beta video not found');
    }

    if (video.userId !== ctx.userId) {
      throw new Error('You can only delete your own beta videos');
    }

    // Delete from Bunny Stream (best effort)
    try {
      await deleteBunnyVideo(video.bunnyVideoId);
    } catch (error) {
      console.error('[BetaVideo] Failed to delete from Bunny Stream:', error);
    }

    // Delete from DB
    await db.delete(dbSchema.boardseshBetaVideos).where(eq(dbSchema.boardseshBetaVideos.uuid, uuid));

    return true;
  },
};

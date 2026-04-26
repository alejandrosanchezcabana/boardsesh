import type { IncomingMessage, ServerResponse } from 'http';
import { applyCorsHeaders } from './cors';
import { db } from '../db/client';
import { boardseshBetaVideos } from '@boardsesh/db/schema/app';
import { eq } from 'drizzle-orm';
import { getBunnyThumbnailUrl } from '../lib/bunny-stream';

type BunnyWebhookPayload = {
  VideoGuid: string;
  VideoLibraryId: number;
  Status: number; // 3 = finished encoding, 4 = resolution finished (ready), 5 = encoding/upload failed
};

/**
 * Handle Bunny Stream webhook callbacks for video encoding status.
 * Bunny sends a POST when video encoding completes or fails.
 *
 * Status codes:
 * - 3: Finished encoding (ready to play)
 * - 4: Resolution finished (all resolutions encoded, ready to play)
 * - 5: Encoding/upload failed
 */
export async function handleBunnyWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!applyCorsHeaders(req, res)) return;

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    // Parse JSON body with size limit (10KB max)
    const body = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString();
        if (data.length > 10240) {
          req.destroy();
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    const payload = JSON.parse(body) as BunnyWebhookPayload;
    const { VideoGuid, Status } = payload;

    if (!VideoGuid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing VideoGuid' }));
      return;
    }

    // Map Bunny status to our status
    let newStatus: string;
    if (Status === 3 || Status === 4) {
      newStatus = 'ready';
    } else if (Status === 5) {
      newStatus = 'failed';
    } else {
      // Unknown status, ignore
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Update the video record
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === 'ready') {
      updateData.thumbnailUrl = getBunnyThumbnailUrl(VideoGuid);
    }

    await db.update(boardseshBetaVideos).set(updateData).where(eq(boardseshBetaVideos.bunnyVideoId, VideoGuid));

    console.info(`[BunnyWebhook] Video ${VideoGuid} status updated to ${newStatus}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    if (error instanceof Error && error.message === 'Payload too large') {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }
    console.error('[BunnyWebhook] Error processing webhook:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

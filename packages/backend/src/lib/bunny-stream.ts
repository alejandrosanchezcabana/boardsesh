/**
 * Bunny Stream API client for video hosting.
 * Server-side only — never import in client components.
 */

import { createHash } from 'node:crypto';

const BUNNY_API_BASE = 'https://video.bunnycdn.com';

function getConfig() {
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME;
  return { apiKey, libraryId, cdnHostname };
}

export function isBunnyStreamConfigured(): boolean {
  const { apiKey, libraryId, cdnHostname } = getConfig();
  return !!(apiKey && libraryId && cdnHostname);
}

type BunnyVideoResponse = {
  guid: string;
  title: string;
  status: number;
  length: number;
  thumbnailFileName: string;
};

/**
 * Create a new video entry in Bunny Stream.
 * Returns the video GUID for subsequent upload.
 */
export async function createBunnyVideo(title: string): Promise<BunnyVideoResponse> {
  const { apiKey, libraryId } = getConfig();
  if (!apiKey || !libraryId) {
    throw new Error('Bunny Stream is not configured');
  }

  const response = await fetch(`${BUNNY_API_BASE}/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      AccessKey: apiKey,
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bunny Stream create video failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<BunnyVideoResponse>;
}

/**
 * Generate the authorization signature for TUS uploads.
 * Bunny Stream uses SHA256(libraryId + apiKey + expirationTime + videoId).
 */
export async function generateTusAuthSignature(videoId: string, expirationTime: number): Promise<string> {
  const { apiKey, libraryId } = getConfig();
  if (!apiKey || !libraryId) {
    throw new Error('Bunny Stream is not configured');
  }

  const crypto = await import('crypto');
  const signatureContent = `${libraryId}${apiKey}${expirationTime}${videoId}`;
  return crypto.createHash('sha256').update(signatureContent).digest('hex');
}

/**
 * Get complete TUS upload credentials for the client.
 * Returns everything the browser needs to upload directly to Bunny.
 */
export async function getTusUploadCredentials(videoId: string): Promise<{
  uploadUrl: string;
  authorizationSignature: string;
  authorizationExpire: number;
  videoId: string;
  libraryId: string;
}> {
  const { libraryId } = getConfig();
  if (!libraryId) {
    throw new Error('Bunny Stream is not configured');
  }

  // Signature expires in 24 hours
  const expirationTime = Math.floor(Date.now() / 1000) + 86400;
  const signature = await generateTusAuthSignature(videoId, expirationTime);

  return {
    uploadUrl: 'https://video.bunnycdn.com/tusupload',
    authorizationSignature: signature,
    authorizationExpire: expirationTime,
    videoId,
    libraryId,
  };
}

/**
 * Get video status from Bunny Stream.
 */
export async function getBunnyVideoStatus(videoId: string): Promise<BunnyVideoResponse> {
  const { apiKey, libraryId } = getConfig();
  if (!apiKey || !libraryId) {
    throw new Error('Bunny Stream is not configured');
  }

  const response = await fetch(`${BUNNY_API_BASE}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Bunny Stream get video failed (${response.status})`);
  }

  return response.json() as Promise<BunnyVideoResponse>;
}

/**
 * Generate a signed token for Bunny Stream CDN URLs.
 * Token = SHA256(apiKey + videoId + expirationTimestamp)
 * URLs expire after the given TTL (default 4 hours).
 */
function signCdnUrl(baseUrl: string, videoId: string, ttlSeconds = 14400): string {
  const { apiKey } = getConfig();
  if (!apiKey) {
    return baseUrl;
  }

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash('sha256').update(`${apiKey}${videoId}${expires}`).digest('hex');
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${token}&expires=${expires}`;
}

/**
 * Construct an unsigned thumbnail URL for storage in the database.
 * Do NOT serve this directly to clients — use getSignedThumbnailUrl instead.
 */
export function getBunnyThumbnailUrl(videoId: string): string {
  const { cdnHostname } = getConfig();
  if (!cdnHostname) {
    throw new Error('Bunny Stream CDN hostname not configured');
  }

  return `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
}

/**
 * Construct a signed thumbnail URL for serving to clients.
 * Expires after 4 hours.
 */
export function getSignedThumbnailUrl(videoId: string): string {
  return signCdnUrl(getBunnyThumbnailUrl(videoId), videoId);
}

/**
 * Construct a signed HLS playback URL for serving to clients.
 * Expires after 4 hours.
 */
export function getSignedPlaybackUrl(videoId: string): string {
  const { cdnHostname } = getConfig();
  if (!cdnHostname) {
    throw new Error('Bunny Stream CDN hostname not configured');
  }

  return signCdnUrl(`https://${cdnHostname}/${videoId}/playlist.m3u8`, videoId);
}

/**
 * Delete a video from Bunny Stream.
 */
export async function deleteBunnyVideo(videoId: string): Promise<void> {
  const { apiKey, libraryId } = getConfig();
  if (!apiKey || !libraryId) {
    throw new Error('Bunny Stream is not configured');
  }

  const response = await fetch(`${BUNNY_API_BASE}/library/${libraryId}/videos/${videoId}`, {
    method: 'DELETE',
    headers: { AccessKey: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Bunny Stream delete video failed (${response.status})`);
  }
}

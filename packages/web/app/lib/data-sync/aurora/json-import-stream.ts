import type { ImportProgressEvent, ImportResult } from './json-import';

const CHUNK_SIZE = 500;

interface ChunkPayload {
  boardType: 'kilter' | 'tension';
  data: {
    user: { username: string; email_address?: string; created_at?: string };
    ascents: unknown[];
    attempts: unknown[];
    circuits: unknown[];
  };
  skipSessionBuild: boolean;
}

/**
 * Splits an array into chunks of the given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Merges two ImportResult objects by summing their counts.
 */
function mergeResults(a: ImportResult, b: ImportResult): ImportResult {
  return {
    ascents: {
      imported: a.ascents.imported + b.ascents.imported,
      skipped: a.ascents.skipped + b.ascents.skipped,
      failed: a.ascents.failed + b.ascents.failed,
    },
    attempts: {
      imported: a.attempts.imported + b.attempts.imported,
      skipped: a.attempts.skipped + b.attempts.skipped,
      failed: a.attempts.failed + b.attempts.failed,
    },
    circuits: {
      imported: a.circuits.imported + b.circuits.imported,
      skipped: a.circuits.skipped + b.circuits.skipped,
      failed: a.circuits.failed + b.circuits.failed,
    },
    unresolvedClimbs: [...new Set([...a.unresolvedClimbs, ...b.unresolvedClimbs])],
  };
}

/**
 * Sends a single chunk to the import endpoint and reads the streaming response.
 * Returns the ImportResult from the 'complete' event, or throws on error.
 */
async function sendChunk(
  payload: ChunkPayload,
  onEvent: (event: ImportProgressEvent) => void,
): Promise<ImportResult | null> {
  const response = await fetch('/api/internal/aurora-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Import failed';
    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
    } catch {
      // Response body isn't valid JSON (e.g. HTML error page)
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ImportResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (line.trim()) {
        try {
          const event: ImportProgressEvent = JSON.parse(line);
          if (event.type === 'complete') {
            result = event.results;
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
          // Forward progress events but not complete/error (we aggregate those)
          if (event.type === 'progress') {
            onEvent(event);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Import failed') throw e;
          console.warn('Failed to parse import stream line:', line);
        }
      }
    }
  }

  if (buffer.trim()) {
    try {
      const event: ImportProgressEvent = JSON.parse(buffer);
      if (event.type === 'complete') {
        result = event.results;
      } else if (event.type === 'error') {
        throw new Error(event.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== 'Import failed') throw e;
      console.warn('Failed to parse import stream buffer:', buffer);
    }
  }

  return result;
}

/**
 * Streams an Aurora JSON import, splitting data into chunks to stay within
 * Vercel's request body size limits. Each chunk is sent as a separate request
 * and results are merged client-side.
 */
export async function streamImport(
  boardType: 'kilter' | 'tension',
  data: unknown,
  onEvent: (event: ImportProgressEvent) => void,
): Promise<void> {
  const typedData = data as {
    user: { username: string; email_address?: string; created_at?: string };
    ascents?: unknown[];
    attempts?: unknown[];
    circuits?: unknown[];
  };

  const user = typedData.user;
  const ascents = typedData.ascents ?? [];
  const attempts = typedData.attempts ?? [];
  const circuits = typedData.circuits ?? [];

  // Build list of chunks to send
  const ascentChunks = chunk(ascents, CHUNK_SIZE);
  const attemptChunks = chunk(attempts, CHUNK_SIZE);

  // Circuits are typically small, send them all in one chunk
  const allChunks: ChunkPayload[] = [];

  for (const batch of ascentChunks) {
    allChunks.push({
      boardType,
      data: { user, ascents: batch, attempts: [], circuits: [] },
      skipSessionBuild: true,
    });
  }

  for (const batch of attemptChunks) {
    allChunks.push({
      boardType,
      data: { user, ascents: [], attempts: batch, circuits: [] },
      skipSessionBuild: true,
    });
  }

  // Circuits go in the last chunk (or as a standalone if no other data)
  if (circuits.length > 0) {
    allChunks.push({
      boardType,
      data: { user, ascents: [], attempts: [], circuits },
      skipSessionBuild: true,
    });
  }

  // If no data at all, send a single empty chunk
  if (allChunks.length === 0) {
    allChunks.push({
      boardType,
      data: { user, ascents: [], attempts: [], circuits: [] },
      skipSessionBuild: false,
    });
  }

  // The last chunk triggers session building
  allChunks[allChunks.length - 1].skipSessionBuild = false;

  const emptyResult: ImportResult = {
    ascents: { imported: 0, skipped: 0, failed: 0 },
    attempts: { imported: 0, skipped: 0, failed: 0 },
    circuits: { imported: 0, skipped: 0, failed: 0 },
    unresolvedClimbs: [],
  };

  let merged = emptyResult;
  const totalChunks = allChunks.length;

  for (let i = 0; i < totalChunks; i++) {
    onEvent({
      type: 'progress',
      step: 'resolving',
      message: `Processing batch ${i + 1} of ${totalChunks}...`,
    });

    const chunkResult = await sendChunk(allChunks[i], onEvent);
    if (chunkResult) {
      merged = mergeResults(merged, chunkResult);
    }
  }

  onEvent({ type: 'complete', results: merged });
}

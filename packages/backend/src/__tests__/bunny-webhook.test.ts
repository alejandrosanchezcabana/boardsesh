import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import crypto from 'crypto';

const { mockDb, mockGetBunnyThumbnailUrl } = vi.hoisted(() => {
  const setMock = vi.fn().mockReturnThis();
  const whereMock = vi.fn().mockResolvedValue(undefined);

  const mockDb = {
    update: vi.fn().mockReturnValue({
      set: setMock,
    }),
    _setMock: setMock,
    _whereMock: whereMock,
  };

  // Wire set -> where chain
  setMock.mockReturnValue({ where: whereMock });

  const mockGetBunnyThumbnailUrl = vi.fn().mockReturnValue('https://cdn.test/video-guid/thumbnail.jpg');

  return { mockDb, mockGetBunnyThumbnailUrl };
});

vi.mock('../db/client', () => ({
  db: mockDb,
}));

vi.mock('../lib/bunny-stream', () => ({
  getBunnyThumbnailUrl: mockGetBunnyThumbnailUrl,
}));

vi.mock('../handlers/cors', () => ({
  applyCorsHeaders: vi.fn().mockReturnValue(true),
}));

import { handleBunnyWebhook } from '../handlers/bunny-webhook';

function createMockReq(method: string, body: string, headers: Record<string, string> = {}): IncomingMessage {
  const readable = new Readable({
    read() {
      this.push(body);
      this.push(null);
    },
  });

  return Object.assign(readable, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    url: '/webhook/bunny',
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    connection: {} as never,
    socket: {} as never,
    aborted: false,
    complete: false,
    trailers: {},
    rawTrailers: [],
    rawHeaders: [],
    statusCode: undefined,
    statusMessage: undefined,
  }) as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & { _statusCode: number; _body: string } {
  const res = {
    _statusCode: 0,
    _body: '',
    _headers: {} as Record<string, string>,
    writeHead(code: number, headers?: Record<string, string>) {
      res._statusCode = code;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    end(body?: string) {
      if (body) res._body = body;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
    },
  };
  return res as unknown as ServerResponse & { _statusCode: number; _body: string };
}

describe('handleBunnyWebhook', () => {
  const originalSigningKey = process.env.BUNNY_WEBHOOK_SIGNING_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BUNNY_WEBHOOK_SIGNING_KEY;
  });

  afterEach(() => {
    if (originalSigningKey === undefined) {
      delete process.env.BUNNY_WEBHOOK_SIGNING_KEY;
    } else {
      process.env.BUNNY_WEBHOOK_SIGNING_KEY = originalSigningKey;
    }
  });

  it('rejects non-POST requests with 405', async () => {
    const req = createMockReq('GET', '');
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(405);
    expect(JSON.parse(res._body)).toEqual({ error: 'Method not allowed' });
  });

  it('returns 413 for oversized body', async () => {
    const oversizedBody = 'x'.repeat(10241);
    const readable = new Readable({
      read() {
        this.push(oversizedBody);
        this.push(null);
      },
    });

    const req = Object.assign(readable, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      url: '/webhook/bunny',
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      connection: {} as never,
      socket: {} as never,
      aborted: false,
      complete: false,
      trailers: {},
      rawTrailers: [],
      rawHeaders: [],
      statusCode: undefined,
      statusMessage: undefined,
      destroy: vi.fn(),
    }) as unknown as IncomingMessage;

    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(413);
    expect(JSON.parse(res._body)).toEqual({ error: 'Payload too large' });
  });

  it('returns 400 for missing VideoGuid', async () => {
    const body = JSON.stringify({ Status: 3 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: 'Missing VideoGuid' });
  });

  it('processes status 3 (finished encoding) correctly - updates DB to ready', async () => {
    const body = JSON.stringify({ VideoGuid: 'video-123', Status: 3, VideoLibraryId: 1 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb._setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        thumbnailUrl: 'https://cdn.test/video-guid/thumbnail.jpg',
      }),
    );
    expect(mockGetBunnyThumbnailUrl).toHaveBeenCalledWith('video-123');
  });

  it('processes status 4 (resolution finished) correctly - updates DB to ready', async () => {
    const body = JSON.stringify({ VideoGuid: 'video-456', Status: 4, VideoLibraryId: 1 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb._setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        thumbnailUrl: 'https://cdn.test/video-guid/thumbnail.jpg',
      }),
    );
  });

  it('processes status 5 (failed) correctly - updates DB to failed', async () => {
    const body = JSON.stringify({ VideoGuid: 'video-789', Status: 5, VideoLibraryId: 1 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb._setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    // Should NOT set thumbnailUrl for failed videos
    expect(mockGetBunnyThumbnailUrl).not.toHaveBeenCalled();
  });

  it('ignores unknown status codes with 200', async () => {
    const body = JSON.stringify({ VideoGuid: 'video-abc', Status: 1, VideoLibraryId: 1 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('validates webhook signature when BUNNY_WEBHOOK_SIGNING_KEY is set', async () => {
    const signingKey = 'test-secret-key';
    process.env.BUNNY_WEBHOOK_SIGNING_KEY = signingKey;

    const body = JSON.stringify({ VideoGuid: 'video-signed', Status: 3, VideoLibraryId: 1 });
    const expectedSignature = crypto.createHmac('sha256', signingKey).update(body).digest('hex');

    const req = createMockReq('POST', body, { 'webhook-signature': expectedSignature });
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('rejects invalid signature with 401', async () => {
    const signingKey = 'test-secret-key';
    process.env.BUNNY_WEBHOOK_SIGNING_KEY = signingKey;

    const body = JSON.stringify({ VideoGuid: 'video-bad-sig', Status: 3, VideoLibraryId: 1 });
    const req = createMockReq('POST', body, { 'webhook-signature': 'wrong-signature' });
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: 'Invalid webhook signature' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('rejects missing signature when signing key is configured', async () => {
    process.env.BUNNY_WEBHOOK_SIGNING_KEY = 'test-secret-key';

    const body = JSON.stringify({ VideoGuid: 'video-no-sig', Status: 3, VideoLibraryId: 1 });
    const req = createMockReq('POST', body);
    const res = createMockRes();

    await handleBunnyWebhook(req, res);

    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: 'Missing webhook signature' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

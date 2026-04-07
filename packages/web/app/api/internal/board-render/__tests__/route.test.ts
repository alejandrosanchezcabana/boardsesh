// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock WASM module - returns raw RGBA with 8-byte dimension header
const mockRenderOverlay = vi.fn((_config: string) => {
  // 2x2 pixel image: 8 bytes header + 16 bytes RGBA data
  const buf = new Uint8Array(8 + 16);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 2, true); // width = 2
  view.setUint32(4, 2, true); // height = 2
  // Fill RGBA with semi-transparent red
  for (let i = 8; i < 24; i += 4) {
    buf[i] = 255; // R
    buf[i + 1] = 0; // G
    buf[i + 2] = 0; // B
    buf[i + 3] = 128; // A
  }
  return buf;
});
vi.mock('@boardsesh/board-renderer-wasm', () => ({
  default: vi.fn(),
  initSync: vi.fn(),
  render_overlay: (config: string) => mockRenderOverlay(config),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(() => Promise.resolve(new Uint8Array([0]))),
}));
const mockExistsSync = vi.fn<(path: string) => boolean>(() => true);
vi.mock('fs', () => ({
  existsSync: (path: string) => mockExistsSync(path),
}));

// Mock sharp - tracks calls to composite() and webp() options
const mockComposite = vi.fn();
const mockResize = vi.fn();
const mockWebpOptions = vi.fn();
const mockSharpInstance = () => {
  const instance = {
    composite: vi.fn((...args: unknown[]) => {
      mockComposite(...args);
      return instance;
    }),
    resize: vi.fn((...args: unknown[]) => {
      mockResize(...args);
      return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0xB0]))) };
    }),
    webp: vi.fn((opts: unknown) => {
      mockWebpOptions(opts);
      return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0x52, 0x49, 0x46, 0x46]))) };
    }),
  };
  return instance;
};
const mockSharpDefault = vi.fn((_input?: unknown, _options?: unknown) => mockSharpInstance());
vi.mock('sharp', () => ({
  default: (input?: unknown, options?: unknown) => mockSharpDefault(input, options),
}));

vi.mock('@/app/lib/board-utils', () => ({
  getBoardDetailsForBoard: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 7,
    set_ids: [1, 20],
    boardWidth: 1080,
    boardHeight: 1350,
    holdsData: [
      { id: 1073, mirroredHoldId: null, cx: 200, cy: 300, r: 20 },
      { id: 1090, mirroredHoldId: null, cx: 500, cy: 600, r: 20 },
    ],
    images_to_holds: { 'test.png': [] },
    edge_left: 0,
    edge_right: 144,
    edge_bottom: 0,
    edge_top: 180,
  })),
}));

vi.mock('@/app/components/board-renderer/types', () => ({
  THUMBNAIL_WIDTH: 200,
  HOLD_STATE_MAP: {
    kilter: {
      42: { name: 'STARTING', color: '#00FF00' },
      43: { name: 'HAND', color: '#00FFFF' },
      44: { name: 'FINISH', color: '#FF00FF' },
      45: { name: 'FOOT', color: '#FFAA00' },
    },
    tension: {},
    moonboard: {},
  },
}));

import { GET } from '../route';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/internal/board-render');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const validParams = {
  board_name: 'kilter',
  layout_id: '1',
  size_id: '7',
  set_ids: '1,20',
  frames: 'p1073r42p1090r43',
};

describe('board-render API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('returns 200 with WebP content for valid request', async () => {
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=31536000, max-age=31536000, immutable');
  });

  it('returns 400 when board_name is missing', async () => {
    const { board_name: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing required parameters');
  });

  it('returns 400 when frames is missing', async () => {
    const { frames: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid board_name', async () => {
    const response = await GET(makeRequest({ ...validParams, board_name: 'invalid' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid board_name');
  });

  it('passes thumbnail flag in render config when thumbnail=1', async () => {
    await GET(makeRequest({ ...validParams, thumbnail: '1' }));
    const configJson = mockRenderOverlay.mock.calls[0][0];
    const config = JSON.parse(configJson);
    expect(config.thumbnail).toBe(true);
    expect(config.output_width).toBe(200);
  });

  it('uses native board width when not thumbnail', async () => {
    await GET(makeRequest(validParams));
    const configJson = mockRenderOverlay.mock.calls[0][0];
    const config = JSON.parse(configJson);
    expect(config.thumbnail).toBe(false);
    expect(config.output_width).toBe(1080);
  });

  it('always sets mirrored to false', async () => {
    await GET(makeRequest(validParams));
    const configJson = mockRenderOverlay.mock.calls[0][0];
    const config = JSON.parse(configJson);
    expect(config.mirrored).toBe(false);
  });

  it('returns 500 when render throws', async () => {
    mockRenderOverlay.mockImplementationOnce(() => {
      throw new Error('render exploded');
    });
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('render exploded');
  });

  it('calls composite with background when include_background=1', async () => {
    const response = await GET(makeRequest({ ...validParams, thumbnail: '1', include_background: '1' }));
    expect(response.status).toBe(200);
    // composite() should have been called (background + overlay layers)
    expect(mockComposite).toHaveBeenCalled();
    // Should use lossy WebP for composited output
    expect(mockWebpOptions).toHaveBeenCalledWith({ quality: 80 });
  });

  it('does not call composite without include_background', async () => {
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(200);
    expect(mockComposite).not.toHaveBeenCalled();
    expect(mockWebpOptions).toHaveBeenCalledWith({ lossless: true });
  });

  it('falls back to lossless when background images are missing', async () => {
    // Make findPublicImagePath return null for all candidates
    mockExistsSync.mockImplementation((path) => path.includes('.wasm'));
    const response = await GET(makeRequest({ ...validParams, include_background: '1' }));
    expect(response.status).toBe(200);
    // Should fall back to lossless since no backgrounds found
    expect(mockComposite).not.toHaveBeenCalled();
    expect(mockWebpOptions).toHaveBeenCalledWith({ lossless: true });
  });

  it('composites successfully when some background images fail to load', async () => {
    // Override board details to return multiple background image keys
    const { getBoardDetailsForBoard } = await import('@/app/lib/board-utils');
    vi.mocked(getBoardDetailsForBoard).mockReturnValueOnce({
      board_name: 'kilter',
      layout_id: 1,
      size_id: 7,
      set_ids: [1, 20],
      boardWidth: 1080,
      boardHeight: 1350,
      holdsData: [
        { id: 1073, mirroredHoldId: null, cx: 200, cy: 300, r: 20 },
      ],
      images_to_holds: {
        'layer-good.png': [],
        'layer-bad.png': [],
        'layer-also-good.png': [],
      },
      edge_left: 0,
      edge_right: 144,
      edge_bottom: 0,
      edge_top: 180,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Make sharp fail for paths containing "layer-bad" but succeed for others
    let callIndex = 0;
    mockSharpDefault.mockImplementation(() => {
      const idx = callIndex++;
      // First call is the WASM overlay sharp (raw buffer), calls after are backgrounds.
      // Background calls: index 0 = good, index 1 = bad, index 2 = good
      const instance = {
        composite: vi.fn((...args: unknown[]) => {
          mockComposite(...args);
          return instance;
        }),
        resize: vi.fn((...args: unknown[]) => {
          mockResize(...args);
          if (idx === 1) {
            // Second background image fails
            return { toBuffer: vi.fn(() => Promise.reject(new Error('corrupt image'))) };
          }
          return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0xB0]))) };
        }),
        webp: vi.fn((opts: unknown) => {
          mockWebpOptions(opts);
          return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0x52, 0x49, 0x46, 0x46]))) };
        }),
      };
      return instance;
    });

    const response = await GET(makeRequest({ ...validParams, include_background: '1' }));
    expect(response.status).toBe(200);
    // Composite should still be called with the surviving backgrounds + overlay
    expect(mockComposite).toHaveBeenCalled();
    // Should use lossy WebP (composited output) not lossless (fallback)
    expect(mockWebpOptions).toHaveBeenCalledWith({ quality: 80 });
  });
});

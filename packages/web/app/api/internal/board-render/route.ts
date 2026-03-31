import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { HOLD_STATE_MAP } from '@/app/components/board-renderer/types';
import type { BoardName } from '@/app/lib/types';

// Node.js runtime for reliable WASM loading via filesystem
export const runtime = 'nodejs';

// Lazily initialized WASM module with promise lock to prevent thundering herd
let renderOverlay: ((configJson: string) => Uint8Array) | null = null;
let wasmInitPromise: Promise<void> | null = null;

function findWasmPath(): string {
  const wasmFilename = 'board_renderer_wasm_bg.wasm';
  const candidates = [
    // Monorepo dev: cwd is packages/web, workspace deps hoisted to root
    join(process.cwd(), '..', '..', 'node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Vercel standalone: cwd is /var/task, node_modules at root
    join(process.cwd(), 'node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Vercel standalone: nested under packages/web
    join(process.cwd(), 'packages/web/node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Relative to __dirname (works if file tracing copies it alongside the route)
    join(process.cwd(), '.next/server', wasmFilename),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Log all searched paths to help debug Vercel deployment issues
  console.error(`WASM file not found. cwd=${process.cwd()}, searched:`, candidates);
  return candidates[0];
}

async function ensureWasmInitialized() {
  if (renderOverlay) return;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const wasmModule = await import('@boardsesh/board-renderer-wasm');
      const wasmPath = findWasmPath();
      const wasmBytes = await readFile(wasmPath);
      wasmModule.initSync({ module: wasmBytes });
      renderOverlay = wasmModule.render_overlay;
    })();
  }
  await wasmInitPromise;
}

const VALID_BOARD_NAMES = new Set(['kilter', 'tension', 'moonboard']);

// Thumbnail: 300px wide (sharp on 2x retina at ~150css-px)
// Full: native board resolution for crisp rendering in climb drawer/card cover
const THUMBNAIL_WIDTH = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const boardName = searchParams.get('board_name');
    const layoutId = searchParams.get('layout_id');
    const sizeId = searchParams.get('size_id');
    const setIds = searchParams.get('set_ids');
    const frames = searchParams.get('frames');
    const thumbnail = searchParams.get('thumbnail') === '1';
    // Mirroring is handled client-side via CSS scaleX(-1) to maximize cache hit rate

    if (!boardName || !layoutId || !sizeId || !setIds || !frames) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!VALID_BOARD_NAMES.has(boardName)) {
      return NextResponse.json({ error: 'Invalid board_name' }, { status: 400 });
    }

    const parsedSetIds = setIds.split(',').map(Number).filter((n) => !isNaN(n));

    // Get board details (pure computation, no DB)
    const boardDetails = getBoardDetailsForBoard({
      board_name: boardName as BoardName,
      layout_id: Number(layoutId),
      size_id: Number(sizeId),
      set_ids: parsedSetIds,
    });

    // Build hold state map for this board
    const holdStateMap: Record<number, { color: string }> = {};
    const boardStates = HOLD_STATE_MAP[boardName as BoardName];
    for (const [code, info] of Object.entries(boardStates)) {
      holdStateMap[Number(code)] = { color: info.color };
    }

    // Build the render config
    const config = {
      board_name: boardName,
      board_width: boardDetails.boardWidth,
      board_height: boardDetails.boardHeight,
      output_width: thumbnail ? THUMBNAIL_WIDTH : boardDetails.boardWidth,
      frames,
      mirrored: false,
      thumbnail,
      holds: boardDetails.holdsData.map((h) => ({
        id: h.id,
        mirroredHoldId: h.mirroredHoldId,
        cx: h.cx,
        cy: h.cy,
        r: h.r,
      })),
      hold_state_map: holdStateMap,
    };

    // Initialize WASM if needed and render
    await ensureWasmInitialized();
    if (!renderOverlay) {
      return NextResponse.json({ error: 'WASM renderer failed to initialize' }, { status: 500 });
    }
    const wasmT0 = performance.now();
    const rawBytes = renderOverlay(JSON.stringify(config));
    const wasmMs = performance.now() - wasmT0;

    // Parse dimension header: first 8 bytes are width + height as u32 LE
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const rgbaData = rawBytes.subarray(8);

    // Encode to WebP lossless using sharp (25-30% smaller than PNG)
    const sharpT0 = performance.now();
    const webpBuffer = await sharp(Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength), {
      raw: { width, height, channels: 4 },
    })
      .webp({ lossless: true })
      .toBuffer();
    const sharpMs = performance.now() - sharpT0;

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        // Climbs are immutable -- cache forever at both CDN (s-maxage) and browser (max-age)
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
        // Expose render timing in browser devtools Network panel
        'Server-Timing': `wasm;dur=${wasmMs.toFixed(1)}, sharp;dur=${sharpMs.toFixed(1)}`,
      },
    });
  } catch (error) {
    console.error('Board render error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Render failed: ${message}` }, { status: 500 });
  }
}

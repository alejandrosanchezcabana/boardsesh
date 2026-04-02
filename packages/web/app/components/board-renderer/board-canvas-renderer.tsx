'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BoardDetails } from '@/app/lib/types';
import { renderBoard } from '@/app/lib/board-render-worker/worker-manager';
import { trackRenderComplete, trackRenderError, type RenderContext } from '@/app/lib/rendering-metrics';
import BoardImageLayers from './board-image-layers';

export interface BoardCanvasRendererProps {
  boardDetails: BoardDetails;
  frames: string;
  mirrored: boolean;
  thumbnail?: boolean;
  /** Use object-fit: contain (for swipe carousel where container controls sizing) */
  contain?: boolean;
  /** Additional styles for the canvas element */
  style?: React.CSSProperties;
}

/**
 * Renders a board as a single <canvas> element using a Web Worker + WASM.
 * The worker composites background images + hold overlay off the main thread,
 * returning an ImageBitmap that is drawn directly onto the canvas.
 * Falls back to BoardImageLayers if the worker render fails.
 */
const BoardCanvasRenderer = React.memo(function BoardCanvasRenderer({
  boardDetails,
  frames,
  mirrored,
  thumbnail,
  contain,
  style,
}: BoardCanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasFired = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    // Capture context and time at effect start so metrics are never stale
    const context: RenderContext = thumbnail ? 'thumbnail' : contain ? 'full-board' : 'card';
    const startTime = performance.now();

    renderBoard({ boardDetails, frames, mirrored, thumbnail })
      .then((bitmap) => {
        if (cancelled) return;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
        }
        if (!hasFired.current) {
          hasFired.current = true;
          trackRenderComplete(performance.now() - startTime, context, 'wasm');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Board canvas render failed:', err);
          setFailed(true);
          trackRenderError(context, 'wasm');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardDetails, frames, mirrored, thumbnail, contain]);

  // Fall back to server-rendered image layers if the worker render fails
  if (failed) {
    return (
      <BoardImageLayers
        boardDetails={boardDetails}
        frames={frames}
        mirrored={mirrored}
        thumbnail={thumbnail}
        contain={contain}
        style={style}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: contain ? 'contain' : undefined,
        ...style,
      }}
    />
  );
});

export default BoardCanvasRenderer;

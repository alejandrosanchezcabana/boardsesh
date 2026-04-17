'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BoardDetails } from '@/app/lib/types';
import { isWorkerRenderingSupported, renderBoard, computeCropTop } from '@/app/lib/board-render-worker/worker-manager';
import { trackRenderError, type RenderContext } from '@/app/lib/rendering-metrics';
import { THUMBNAIL_WIDTH } from './types';
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
  const [failed, setFailed] = useState(false);
  const workerSupported = isWorkerRenderingSupported();

  // Compute initial canvas dimensions to match worker output, so the element
  // has a correct intrinsic aspect ratio before the bitmap arrives. Older
  // iOS Safari (18.x) mis-renders canvases that start at the default 300×150
  // inside aspect-ratio containers with absolute positioning.
  const initialWidth = thumbnail ? THUMBNAIL_WIDTH : boardDetails.boardWidth;
  const cropTop = thumbnail ? 0 : computeCropTop(boardDetails, initialWidth);
  const initialHeight = thumbnail
    ? Math.round((THUMBNAIL_WIDTH * boardDetails.boardHeight) / boardDetails.boardWidth)
    : boardDetails.boardHeight - cropTop;

  useEffect(() => {
    const canvas = canvasRef.current;
    // When !workerSupported, the render body below already returns
    // BoardImageLayers, so there is no canvas element and this effect exits
    // here. The workerSupported dep still forces effect re-evaluation if the
    // flag flips mid-session.
    if (!canvas) return;

    let cancelled = false;
    const context: RenderContext = thumbnail ? 'thumbnail' : contain ? 'full-board' : 'card';

    renderBoard({ boardDetails, frames, mirrored, thumbnail, cropTop })
      .then((bitmap) => {
        if (cancelled) return;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
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
      // Release GPU backing store immediately instead of waiting for GC
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [boardDetails, frames, mirrored, thumbnail, contain, workerSupported]);

  // Fall back to server-rendered image layers if the worker render fails
  if (failed || !workerSupported) {
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

  // Cropped boards top-align so the board starts right under the header;
  // uncropped (wide) boards center vertically in the available space.
  const topAlign = cropTop > 0;

  if (contain || thumbnail) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: topAlign ? 'flex-start' : 'center',
          overflow: 'hidden',
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          width={initialWidth}
          height={initialHeight}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', overflow: 'hidden', ...style }}>
      <canvas
        ref={canvasRef}
        width={initialWidth}
        height={initialHeight}
        style={{
          gridArea: '1 / 1',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
});

export default BoardCanvasRenderer;

import { track } from '@vercel/analytics';

export type RenderContext = 'thumbnail' | 'card' | 'full-board' | 'feed';

// Cap render events per session to avoid flooding analytics on long lists.
// Counter persists across SPA navigations (only resets on full page load).
const MAX_RENDER_EVENTS = 5;
let renderEventCount = 0;
let errorEventCount = 0;

export function trackRenderComplete(
  durationMs: number,
  context: RenderContext,
  renderer: 'svg' | 'rust-wasm',
) {
  if (renderEventCount >= MAX_RENDER_EVENTS) return;
  renderEventCount++;
  track('Board Render Complete', {
    durationMs: Math.round(durationMs),
    context,
    renderer,
  });
}

export function trackRenderError(
  context: RenderContext,
  renderer: 'svg' | 'rust-wasm',
) {
  if (errorEventCount >= MAX_RENDER_EVENTS) return;
  errorEventCount++;
  track('Board Render Error', { context, renderer });
}

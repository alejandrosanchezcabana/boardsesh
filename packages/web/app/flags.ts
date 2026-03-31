import { flag } from '@vercel/flags/next';

export const rustSvgRendering = flag<boolean>({
  key: 'rust-svg-rendering',
  decide: () => false,
  description: 'Use Rust WASM renderer for board overlays instead of SVG',
});

import { flag } from 'flags/next';
import { vercelAdapter } from '@flags-sdk/vercel';

export const rustSvgRendering = flag({
  key: 'rust-svg-rendering',
  adapter: vercelAdapter(),
  defaultValue: false,
  description: 'Use Rust WASM renderer for board overlays instead of SVG',
  options: [
    { value: true, label: 'Enabled' },
    { value: false, label: 'Disabled' },
  ],
  decide() {
    return false;
  },
});

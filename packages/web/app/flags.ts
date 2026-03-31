import { flag } from '@vercel/flags/next';

export const rustSvgRendering = flag<boolean>({
  key: 'rust-svg-rendering',
  defaultValue: false,
  description: 'Use Rust WASM renderer for board overlays instead of SVG',
  options: [
    { value: true, label: 'Enabled' },
    { value: false, label: 'Disabled' },
  ],
  decide() {
    return this.defaultValue as boolean;
  },
});

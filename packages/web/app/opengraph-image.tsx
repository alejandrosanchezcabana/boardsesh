import React from 'react';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeTokens } from './theme/theme-config';

export const runtime = 'nodejs';

export const alt = 'Boardsesh - Train smarter on your climbing board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Resolve the icon next to this source file so the read works regardless of
// the runtime's cwd. Next.js's bundler doesn't populate `import.meta.dirname`,
// so fall back to deriving it from `import.meta.url`.
const moduleDir = dirname(fileURLToPath(import.meta.url));
const iconSvg = readFileSync(join(moduleDir, 'icon.svg'));
const iconDataUrl = `data:image/svg+xml;base64,${iconSvg.toString('base64')}`;

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0e0e10',
        fontFamily: 'sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconDataUrl} width={320} height={320} alt="" />

      <div
        style={{
          fontSize: 128,
          fontWeight: 900,
          color: themeTokens.text.brandPrimary,
          letterSpacing: '-2px',
          marginTop: 24,
        }}
      >
        boardsesh
      </div>

      <div
        style={{
          fontSize: 36,
          color: themeTokens.text.brandMuted,
          fontWeight: 500,
          marginTop: 12,
          letterSpacing: '6px',
        }}
      >
        ONE APP FOR YOUR BOARDS
      </div>
    </div>,
    { ...size },
  );
}

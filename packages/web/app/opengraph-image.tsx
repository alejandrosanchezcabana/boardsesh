import React from 'react';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

export const alt = 'Boardsesh - Train smarter on your climbing board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const iconSvg = readFileSync(join(process.cwd(), 'app', 'icon.svg'));
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
        backgroundColor: '#0a0a0c',
        fontFamily: 'sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconDataUrl} width={320} height={320} alt="" />

      <div
        style={{
          fontSize: 128,
          fontWeight: 900,
          color: '#f4f1ea',
          letterSpacing: '-2px',
          marginTop: 24,
        }}
      >
        boardsesh
      </div>

      <div
        style={{
          fontSize: 36,
          color: '#8a8780',
          fontWeight: 500,
          marginTop: 12,
          letterSpacing: '6px',
        }}
      >
        FROM V11 TO V17
      </div>
    </div>,
    { ...size },
  );
}

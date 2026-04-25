import React from 'react';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Boardsesh - Train smarter on your climbing board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
      {/* Route mark */}
      <svg width="120" height="120" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Context dots */}
        <ellipse cx="10" cy="12" rx="3.6" ry="2.4" fill="#4a4a52" transform="rotate(-10 10 12)" />
        <ellipse cx="52" cy="16" rx="3.6" ry="2.4" fill="#4a4a52" transform="rotate(20 52 16)" />
        <ellipse cx="14" cy="50" rx="3.6" ry="2.4" fill="#4a4a52" transform="rotate(25 14 50)" />
        <ellipse cx="54" cy="50" rx="3.6" ry="2.4" fill="#4a4a52" transform="rotate(-15 54 50)" />
        <ellipse cx="32" cy="32" rx="3.2" ry="2.2" fill="#4a4a52" transform="rotate(5 32 32)" />
        <ellipse cx="22" cy="28" rx="3" ry="2" fill="#4a4a52" transform="rotate(-25 22 28)" />
        <ellipse cx="44" cy="36" rx="3" ry="2" fill="#4a4a52" transform="rotate(14 44 36)" />

        {/* Start hold -- purple */}
        <ellipse cx="28" cy="10" rx="4" ry="2.8" fill="#7a7a7e" transform="rotate(-8 28 10)" />
        <circle cx="28" cy="10" r="9" fill="none" stroke="#c44a8a" strokeWidth="2" />

        {/* Hand hold -- cyan */}
        <ellipse cx="46" cy="26" rx="4" ry="2.8" fill="#7a7a7e" transform="rotate(18 46 26)" />
        <circle cx="46" cy="26" r="9" fill="none" stroke="#3fb8c4" strokeWidth="2" />

        {/* Foot hold -- green */}
        <ellipse cx="18" cy="38" rx="3.6" ry="2.6" fill="#7a7a7e" transform="rotate(-22 18 38)" />
        <circle cx="18" cy="38" r="9" fill="none" stroke="#5fb27a" strokeWidth="2" />

        {/* Finish hold -- orange */}
        <ellipse cx="32" cy="54" rx="4" ry="2.8" fill="#7a7a7e" transform="rotate(5 32 54)" />
        <circle cx="32" cy="54" r="9" fill="none" stroke="#e2a44d" strokeWidth="2" />
      </svg>

      {/* Brand name */}
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: '#f4f1ea',
          letterSpacing: '-1px',
          marginTop: 24,
        }}
      >
        boardsesh
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          color: '#8a8780',
          fontWeight: 500,
          marginTop: 12,
        }}
      >
        Train smarter on your climbing board
      </div>

      {/* Supported boards */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 40,
          fontSize: 16,
          color: '#4a4a52',
        }}
      >
        <span>Kilter</span>
        <span style={{ color: '#333333' }}>-</span>
        <span>Tension</span>
        <span style={{ color: '#333333' }}>-</span>
        <span>MoonBoard</span>
      </div>
    </div>,
    { ...size },
  );
}

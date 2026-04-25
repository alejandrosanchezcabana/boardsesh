import React from 'react';
import { ImageResponse } from 'next/og';
import { RouteMarkContextDots, RouteMarkHolds } from '@/app/components/brand/route-mark-svg';

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
        <RouteMarkContextDots />
        <RouteMarkHolds />
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

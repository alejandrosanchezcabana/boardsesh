import React from 'react';
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { themeTokens } from '@/app/theme/theme-config';
import { formatBoardDisplayName } from '@/app/lib/string-utils';
import { createOgImageHeaders, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';
import { getPlaylistOgSummary } from '@/app/lib/seo/dynamic-og-data';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const routeT0 = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    const version = searchParams.get('v');

    if (!uuid) {
      return new Response('Missing uuid parameter', { status: 400 });
    }

    const dbT0 = performance.now();
    const playlist = await getPlaylistOgSummary(uuid);
    const dbMs = performance.now() - dbT0;

    if (!playlist) {
      return new Response('Playlist not found', { status: 404 });
    }

    if (!playlist.isPublic) {
      return new Response('Playlist is private', { status: 404 });
    }

    const name = playlist.name || 'Playlist';
    const description = playlist.description;
    const color = playlist.color || themeTokens.colors.primary;
    const icon = playlist.icon || null;
    const boardType = playlist.boardType;
    const climbCount = playlist.climbCount;
    const boardLabel = formatBoardDisplayName(boardType);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            padding: '60px 80px',
            gap: '48px',
          }}
        >
          {/* Left: Colored square with icon */}
          <div
            style={{
              width: '280px',
              height: '280px',
              borderRadius: '32px',
              backgroundColor: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: '120px',
                lineHeight: 1,
                color: '#FFFFFF',
              }}
            >
              {icon || '\u{1F3B5}'}
            </div>
          </div>

          {/* Right: Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: themeTokens.neutral[900],
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>

            {description && (
              <div
                style={{
                  fontSize: '24px',
                  color: themeTokens.neutral[500],
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {description.length > 120 ? `${description.slice(0, 120)}...` : description}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '24px',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  color: themeTokens.neutral[600],
                  fontWeight: 600,
                }}
              >
                {climbCount} {climbCount === 1 ? 'climb' : 'climbs'}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  color: themeTokens.neutral[400],
                }}
              >
                {boardLabel}
              </div>
            </div>
          </div>

          {/* Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '40px',
              fontSize: '20px',
              color: themeTokens.neutral[300],
              fontWeight: 600,
            }}
          >
            boardsesh.com
          </div>
        </div>
      ),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: createOgImageHeaders({
          contentType: 'image/png',
          version,
          serverTiming: `db;dur=${dbMs.toFixed(1)}, render;dur=${(performance.now() - routeT0 - dbMs).toFixed(1)}, route;dur=${(performance.now() - routeT0).toFixed(1)}`,
        }),
      },
    );
  } catch (error) {
    console.error('Error generating playlist OG image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating image: ${message}`, { status: 500 });
  }
}

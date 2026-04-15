import React from 'react';
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { themeTokens } from '@/app/theme/theme-config';
import { FONT_GRADE_COLORS, getGradeColorWithOpacity } from '@/app/lib/grade-colors';
import { BOULDER_GRADES } from '@/app/lib/board-data';
import { createOgImageHeaders, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';
import { getSessionOgSummary } from '@/app/lib/seo/dynamic-og-data';

export const runtime = 'edge';

const DIFFICULTY_TO_GRADE: Record<number, string> = Object.fromEntries(
  BOULDER_GRADES.map((g) => [g.difficulty_id, g.font_grade]),
);

const GRADE_ORDER: string[] = BOULDER_GRADES.map((g) => g.font_grade);

export async function GET(request: NextRequest) {
  const routeT0 = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const variant = searchParams.get('variant');
    const version = searchParams.get('v');

    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    const dbT0 = performance.now();
    const summary = await getSessionOgSummary(sessionId);
    const dbMs = performance.now() - dbT0;

    if (!summary.found) {
      return new Response('Session not found', { status: 404 });
    }

    const sessionName = summary.sessionName;
    const participantNames = summary.participantNames.join(', ');

    // Build grade bars
    const gradeBars: Array<{ grade: string; count: number; color: string }> = [];
    for (const row of summary.gradeRows) {
      const difficulty = row.difficulty;
      const count = row.count;
      const grade = DIFFICULTY_TO_GRADE[difficulty];
      if (!grade) continue;

      const hex = FONT_GRADE_COLORS[grade.toLowerCase()];
      const color = hex ? getGradeColorWithOpacity(hex, 0.5) : 'rgba(200, 200, 200, 0.5)';
      gradeBars.push({ grade, count, color });
    }

    // Sort by grade order
    gradeBars.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

    const maxCount = Math.max(...gradeBars.map((b) => b.count), 1);
    const isJoinVariant = variant === 'join';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#FFFFFF',
            padding: '60px 80px',
            gap: '32px',
          }}
        >
          {/* Top section: Session name + participants */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              width: '100%',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: themeTokens.neutral[900],
                lineHeight: 1.2,
              }}
            >
              {sessionName}
            </div>
            {participantNames && (
              <div
                style={{
                  fontSize: '24px',
                  color: themeTokens.neutral[500],
                }}
              >
                {participantNames}
              </div>
            )}
            <div
              style={{
                fontSize: '20px',
                color: themeTokens.neutral[400],
              }}
            >
              {summary.totalSends > 0
                ? `${summary.totalSends} send${summary.totalSends !== 1 ? 's' : ''}`
                : 'No sends yet'}
            </div>
          </div>

          {/* Grade chart */}
          {gradeBars.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                gap: '8px',
              }}
            >
              {/* Bars */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '4px',
                  height: '180px',
                  width: '100%',
                }}
              >
                {gradeBars.map((bar) => (
                  <div
                    key={bar.grade}
                    style={{
                      flex: 1,
                      height: `${Math.max((bar.count / maxCount) * 100, 5)}%`,
                      backgroundColor: bar.color,
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                ))}
              </div>
              {/* Labels */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  width: '100%',
                }}
              >
                {gradeBars.map((bar) => (
                  <div
                    key={bar.grade}
                    style={{
                      flex: 1,
                      fontSize: '14px',
                      textAlign: 'center',
                      color: themeTokens.neutral[400],
                    }}
                  >
                    {bar.grade}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Join CTA */}
          {isJoinVariant && (
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: themeTokens.colors.primary,
                marginTop: '8px',
              }}
            >
              Get on the wall
            </div>
          )}

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
    console.error('Error generating session OG image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating image: ${message}`, { status: 500 });
  }
}

import React from 'react';
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { sql } from '@/app/lib/db/db';
import { themeTokens } from '@/app/theme/theme-config';
import { FONT_GRADE_COLORS, getGradeColorWithOpacity } from '@/app/lib/grade-colors';

export const runtime = 'edge';

// Maps difficulty ID to font grade name (same as profile-constants.ts)
const DIFFICULTY_TO_GRADE: Record<number, string> = {
  10: '4a', 11: '4b', 12: '4c',
  13: '5a', 14: '5b', 15: '5c',
  16: '6a', 17: '6a+', 18: '6b', 19: '6b+',
  20: '6c', 21: '6c+',
  22: '7a', 23: '7a+', 24: '7b', 25: '7b+', 26: '7c', 27: '7c+',
  28: '8a', 29: '8a+', 30: '8b', 31: '8b+', 32: '8c', 33: '8c+',
};

const GRADE_ORDER = Object.values(DIFFICULTY_TO_GRADE);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return new Response('Missing user_id parameter', { status: 400 });
    }

    // Fetch user profile and grade distribution in parallel
    const [userRows, gradeRows] = await Promise.all([
      sql`
        SELECT u.name, u.image, p.display_name, p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ${userId}
        LIMIT 1
      `,
      sql`
        SELECT difficulty, COUNT(DISTINCT climb_uuid) as cnt
        FROM boardsesh_ticks
        WHERE user_id = ${userId}
          AND status IN ('flash', 'send')
          AND difficulty IS NOT NULL
        GROUP BY difficulty
        ORDER BY difficulty
      `,
    ]);

    if (userRows.length === 0) {
      return new Response('User not found', { status: 404 });
    }

    const user = userRows[0];
    const displayName = user.display_name || user.name || 'Crusher';
    const avatarUrl = user.avatar_url || user.image;

    // Build grade bars
    const gradeBars: Array<{ grade: string; count: number; color: string }> = [];
    let totalClimbs = 0;

    for (const row of gradeRows) {
      const difficulty = Number(row.difficulty);
      const count = Number(row.cnt);
      const grade = DIFFICULTY_TO_GRADE[difficulty];
      if (!grade) continue;

      totalClimbs += count;
      const hex = FONT_GRADE_COLORS[grade.toLowerCase()];
      const color = hex ? getGradeColorWithOpacity(hex, 0.5) : 'rgba(200, 200, 200, 0.5)';
      gradeBars.push({ grade, count, color });
    }

    // Sort by grade order
    gradeBars.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

    const maxCount = Math.max(...gradeBars.map((b) => b.count), 1);

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
            gap: '40px',
          }}
        >
          {/* Top section: Avatar + Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
              width: '100%',
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                width={120}
                height={120}
                style={{
                  borderRadius: '60px',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '60px',
                  background: themeTokens.neutral[200],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  color: themeTokens.neutral[500],
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
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
                {displayName}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: themeTokens.neutral[500],
                }}
              >
                {totalClimbs > 0
                  ? `${totalClimbs} distinct climb${totalClimbs !== 1 ? 's' : ''}`
                  : 'Boardsesh climber'}
              </div>
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
                  height: '160px',
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
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error('Error generating profile OG image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating image: ${message}`, { status: 500 });
  }
}

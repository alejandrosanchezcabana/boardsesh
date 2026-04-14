import React from 'react';
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { dbz } from '@/app/lib/db/db';
import { sql } from 'drizzle-orm';
import { themeTokens } from '@/app/theme/theme-config';
import { FONT_GRADE_COLORS, getGradeColorWithOpacity } from '@/app/lib/grade-colors';
import { BOULDER_GRADES } from '@/app/lib/board-data';

export const runtime = 'edge';

const DIFFICULTY_TO_GRADE: Record<number, string> = Object.fromEntries(
  BOULDER_GRADES.map((g) => [g.difficulty_id, g.font_grade]),
);

const GRADE_ORDER: string[] = BOULDER_GRADES.map((g) => g.font_grade);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const variant = searchParams.get('variant');

    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    // Fetch session info, participants, and grade distribution in parallel
    const [sessionResult, participantResult, gradeResult] = await Promise.all([
      dbz.execute<{
        id: string;
        session_name: string | null;
        board_path: string | null;
      }>(sql`
        SELECT bs.id, bs.session_name, bs.board_path
        FROM board_sessions bs
        WHERE bs.id = ${sessionId}
        LIMIT 1
      `),
      dbz.execute<{
        display_name: string;
      }>(sql`
        SELECT DISTINCT
          COALESCE(up.display_name, u.name, 'Climber') as display_name
        FROM boardsesh_ticks bt
        JOIN users u ON u.id = bt.user_id
        LEFT JOIN user_profiles up ON up.user_id = bt.user_id
        WHERE bt.session_id = ${sessionId}
        LIMIT 6
      `),
      dbz.execute<{
        difficulty: number;
        cnt: number;
      }>(sql`
        SELECT bt.difficulty, COUNT(*) as cnt
        FROM boardsesh_ticks bt
        WHERE bt.session_id = ${sessionId}
          AND bt.status IN ('flash', 'send')
          AND bt.difficulty IS NOT NULL
        GROUP BY bt.difficulty
        ORDER BY bt.difficulty
      `),
    ]);
    const sessionRows = sessionResult.rows;
    const participantRows = participantResult.rows;
    const gradeRows = gradeResult.rows;

    if (sessionRows.length === 0) {
      return new Response('Session not found', { status: 404 });
    }

    const session = sessionRows[0];
    const sessionName = (session.session_name as string) || 'Climbing Session';
    const participantNames = participantRows
      .map((r) => r.display_name as string)
      .join(', ');

    // Build grade bars
    const gradeBars: Array<{ grade: string; count: number; color: string }> = [];
    let totalSends = 0;

    for (const row of gradeRows) {
      const difficulty = Number(row.difficulty);
      const count = Number(row.cnt);
      const grade = DIFFICULTY_TO_GRADE[difficulty];
      if (!grade) continue;

      totalSends += count;
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
              {totalSends > 0
                ? `${totalSends} send${totalSends !== 1 ? 's' : ''}`
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
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error('Error generating session OG image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating image: ${message}`, { status: 500 });
  }
}

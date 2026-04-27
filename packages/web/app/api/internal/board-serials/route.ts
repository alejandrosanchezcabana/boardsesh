import { getServerSession } from 'next-auth/next';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '@/app/lib/db/db';
import * as schema from '@/app/lib/db/schema';
import { authOptions } from '@/app/lib/auth/auth-options';
import { checkRateLimit, getClientIp } from '@/app/lib/auth/rate-limiter';
import { AURORA_BOARDS } from '@boardsesh/shared-schema';

const bodySchema = z.object({
  serialNumber: z.string().trim().min(1).max(64),
  boardName: z.enum(AURORA_BOARDS),
  layoutId: z.number().int().nonnegative(),
  sizeId: z.number().int().nonnegative(),
  setIds: z.string().min(1).max(256),
  boardUuid: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIp = getClientIp(request);
    const ipRateLimit = checkRateLimit(`board-serials:${clientIp}`, 30, 60_000);
    if (ipRateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipRateLimit.retryAfterSeconds) } },
      );
    }

    const userRateLimit = checkRateLimit(`board-serials:user:${session.user.id}`, 30, 60_000);
    if (userRateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(userRateLimit.retryAfterSeconds) } },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { serialNumber, boardName, layoutId, sizeId, setIds, boardUuid } = parsed.data;
    const db = getDb();

    // The recording table is a fallback for users who haven't fully populated
    // their saved-boards (user_boards) dataset. If a saved board already
    // exists for this controller, it's authoritative — skip the recording so
    // saved-vs-recorded resolution stays unambiguous.
    const savedMatch = await db
      .select({ id: schema.userBoards.id })
      .from(schema.userBoards)
      .where(
        and(
          eq(schema.userBoards.ownerId, session.user.id),
          eq(schema.userBoards.serialNumber, serialNumber),
          isNull(schema.userBoards.deletedAt),
        ),
      )
      .limit(1);

    if (savedMatch.length > 0) {
      return NextResponse.json({ ok: true, skipped: 'already_saved' });
    }

    // Validate the supplied boardUuid before linking. The client can pass any
    // string; we only persist the link if the user can legitimately reach a
    // /b/{slug}/... route for that board (owner or public). Anything else is
    // silently dropped to null so a forged uuid can't attach the user's
    // controller to someone else's private board.
    let linkedBoardUuid: string | null = null;
    if (boardUuid) {
      const allowed = await db
        .select({ uuid: schema.userBoards.uuid })
        .from(schema.userBoards)
        .where(
          and(
            eq(schema.userBoards.uuid, boardUuid),
            isNull(schema.userBoards.deletedAt),
            or(eq(schema.userBoards.ownerId, session.user.id), eq(schema.userBoards.isPublic, true)),
          ),
        )
        .limit(1);
      if (allowed.length > 0) {
        linkedBoardUuid = boardUuid;
      }
    }

    await db
      .insert(schema.userBoardSerials)
      .values({
        userId: session.user.id,
        serialNumber,
        boardName,
        layoutId,
        sizeId,
        setIds,
        boardUuid: linkedBoardUuid,
      })
      .onConflictDoUpdate({
        target: [schema.userBoardSerials.userId, schema.userBoardSerials.serialNumber],
        set: {
          boardName,
          layoutId,
          sizeId,
          setIds,
          boardUuid: linkedBoardUuid,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to record board serial:', error);
    return NextResponse.json({ error: 'Failed to record board serial' }, { status: 500 });
  }
}

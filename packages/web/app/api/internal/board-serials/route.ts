import { getServerSession } from 'next-auth/next';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '@/app/lib/db/db';
import * as schema from '@/app/lib/db/schema';
import { authOptions } from '@/app/lib/auth/auth-options';
import { checkRateLimit, getClientIp } from '@/app/lib/auth/rate-limiter';
import { AURORA_BOARDS } from '@boardsesh/shared-schema';
import { normaliseSetIds } from '@/app/lib/ble/board-config-match';

const bodySchema = z.object({
  serialNumber: z.string().trim().min(1).max(64),
  boardName: z.enum(AURORA_BOARDS),
  layoutId: z.number().int().nonnegative(),
  sizeId: z.number().int().nonnegative(),
  // Comma-separated positive integers only — no whitespace, no empties. The
  // recorded value flows to the picker preview and "switch config" URL builder
  // through `parseSetIds`, which silently drops non-numeric tokens; rejecting
  // garbage at the boundary keeps recordings useful and labels honest.
  setIds: z
    .string()
    .max(256)
    .regex(/^\d+(,\d+)*$/, 'setIds must be a comma-separated list of integers'),
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

    // If the user already has a saved board for this controller AND its config
    // matches the POST, the recording adds nothing — short-circuit. If the
    // configs differ, fall through and upsert so the recording reflects current
    // reality (the wall might have been physically reconfigured since the
    // saved board was created). The saved-board entry remains authoritative for
    // serial→board lookups, but the recording lets us detect drift.
    const savedMatch = await db
      .select({
        boardType: schema.userBoards.boardType,
        layoutId: schema.userBoards.layoutId,
        sizeId: schema.userBoards.sizeId,
        setIds: schema.userBoards.setIds,
      })
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
      const saved = savedMatch[0];
      const configMatches =
        saved.boardType === boardName &&
        Number(saved.layoutId) === layoutId &&
        Number(saved.sizeId) === sizeId &&
        normaliseSetIds(saved.setIds) === normaliseSetIds(setIds);
      if (configMatches) {
        return NextResponse.json({ ok: true, skipped: 'already_saved' });
      }
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

import { getServerSession } from 'next-auth/next';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/app/lib/db/db';
import * as schema from '@/app/lib/db/schema';
import { authOptions } from '@/app/lib/auth/auth-options';
import { AURORA_BOARDS } from '@boardsesh/shared-schema';

const bodySchema = z.object({
  serialNumber: z.string().trim().min(1),
  boardName: z.enum(AURORA_BOARDS),
  layoutId: z.number().int().nonnegative(),
  sizeId: z.number().int().nonnegative(),
  setIds: z.string().min(1),
  angle: z.number().int().optional(),
  boardUuid: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { serialNumber, boardName, layoutId, sizeId, setIds, angle, boardUuid } = parsed.data;
    const db = getDb();

    await db
      .insert(schema.userBoardSerials)
      .values({
        userId: session.user.id,
        serialNumber,
        boardName,
        layoutId,
        sizeId,
        setIds,
        angle: angle ?? null,
        boardUuid: boardUuid ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.userBoardSerials.userId, schema.userBoardSerials.serialNumber],
        set: {
          boardName,
          layoutId,
          sizeId,
          setIds,
          angle: angle ?? null,
          boardUuid: boardUuid ?? null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to record board serial:', error);
    return NextResponse.json({ error: 'Failed to record board serial' }, { status: 500 });
  }
}

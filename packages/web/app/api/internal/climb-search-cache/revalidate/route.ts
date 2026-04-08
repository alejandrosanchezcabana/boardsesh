import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth/auth-options';
import { revalidateClimbSearchTags } from '@/app/lib/climb-search-cache.server';

const revalidateClimbSearchSchema = z.object({
  boardName: z.enum(['kilter', 'moonboard', 'tension']),
  layoutId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = revalidateClimbSearchSchema.parse(body);

    await revalidateClimbSearchTags({
      boardName: validated.boardName,
      layoutId: validated.layoutId,
      requestHeaders: request.headers,
      source: 'internal-route',
    });

    return NextResponse.json({ revalidated: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }

    console.error('[Climb Search Cache] Revalidation failed:', error);
    return NextResponse.json({ error: 'Failed to revalidate climb search cache' }, { status: 500 });
  }
}

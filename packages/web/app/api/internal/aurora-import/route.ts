import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth/auth-options';
import { auroraExportSchema, importJsonExportData } from '@/app/lib/data-sync/aurora/json-import';
import type { ImportResult } from '@/app/lib/data-sync/aurora/json-import';

export const maxDuration = 60;

const requestSchema = z.object({
  boardType: z.enum(['kilter', 'tension']),
  data: auroraExportSchema,
});

export interface AuroraImportResponse {
  success: boolean;
  results: ImportResult;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { boardType, data } = parsed.data;

    const results = await importJsonExportData(session.user.id, boardType, data);

    return NextResponse.json({ success: true, results } satisfies AuroraImportResponse);
  } catch (error) {
    console.error('Aurora JSON import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 },
    );
  }
}

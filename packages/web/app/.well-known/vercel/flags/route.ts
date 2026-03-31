import { NextResponse } from 'next/server';
import { verifyAccess, type ApiData } from '@vercel/flags';
import { getProviderData } from '@vercel/flags/next';
import * as flags from '../../../flags';

export async function GET(request: Request) {
  const access = await verifyAccess(request.headers.get('Authorization'));
  if (!access) return NextResponse.json(null, { status: 401 });
  return NextResponse.json<ApiData>(getProviderData(flags));
}

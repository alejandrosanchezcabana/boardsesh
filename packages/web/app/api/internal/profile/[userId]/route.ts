import { getServerSession } from 'next-auth/next';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth/auth-options';
import { getProfileData } from '@/app/profile/[user_id]/server-profile-data';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const session = await getServerSession(authOptions);
    const viewerUserId = session?.user?.id;

    const profileData = await getProfileData(userId, viewerUserId);

    if (!profileData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Failed to get profile:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

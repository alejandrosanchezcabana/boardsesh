import 'server-only';
import { getServerSession } from 'next-auth/next';
import { eq, and } from 'drizzle-orm';
import { authOptions } from '@/app/lib/auth/auth-options';
import { getDb } from '@/app/lib/db/db';
import { communityRoles } from '@/app/lib/db/schema';

export type AdminCheck = { authenticated: false } | { authenticated: true; userId: string; isAdmin: boolean };

export async function checkAdmin(): Promise<AdminCheck> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { authenticated: false };

  const rows = await getDb()
    .select({ id: communityRoles.id })
    .from(communityRoles)
    .where(and(eq(communityRoles.userId, userId), eq(communityRoles.role, 'admin')))
    .limit(1);

  return { authenticated: true, userId, isAdmin: rows.length > 0 };
}

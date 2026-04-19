import 'server-only';
import { cache } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';

/**
 * Cached session getter for /you pages.
 * Deduplicates getServerSession calls across layout.tsx and page.tsx
 * within a single request using React cache().
 */
export const getYouSession = cache(async () => {
  return getServerSession(authOptions);
});

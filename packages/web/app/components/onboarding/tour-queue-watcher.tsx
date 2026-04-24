'use client';

import { useEffect } from 'react';
import { useCurrentClimb, useQueueList } from '@/app/components/graphql-queue';
import { useOnboardingTourOptional } from './onboarding-tour-provider';

/**
 * Bridges queue length and current climb from the graphql-queue scope up to
 * the global OnboardingTourProvider. Mounted only on board list pages where
 * the queue context exists. Does nothing when the tour is inactive.
 *
 * Depends on `notifyQueueLength` and `notifyCurrentClimb` directly (not the
 * whole tour object), since those are stable `useCallback`s on the provider
 * side. The rest of the context — `currentStepId`, `start`, `next`, etc. —
 * changes identity on every step transition; depending on the whole object
 * would cause these effects to re-fire (with unchanged data) on every step.
 */
export default function TourQueueWatcher() {
  const tour = useOnboardingTourOptional();
  const notifyQueueLength = tour?.notifyQueueLength;
  const notifyCurrentClimb = tour?.notifyCurrentClimb;
  const { queue } = useQueueList();
  const { currentClimb } = useCurrentClimb();
  const length = queue.length;
  const climbUuid = currentClimb?.uuid ?? null;

  useEffect(() => {
    if (!notifyQueueLength) return;
    notifyQueueLength(length);
  }, [notifyQueueLength, length]);

  useEffect(() => {
    if (!notifyCurrentClimb) return;
    notifyCurrentClimb(climbUuid);
  }, [notifyCurrentClimb, climbUuid]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useCurrentClimb, useQueueList } from '@/app/components/graphql-queue';
import { useOnboardingTourOptional } from './onboarding-tour-provider';

/**
 * Bridges queue length and current climb from the graphql-queue scope up to
 * the global OnboardingTourProvider. Mounted only on board list pages where
 * the queue context exists. Does nothing when the tour is inactive.
 */
export default function TourQueueWatcher() {
  const tour = useOnboardingTourOptional();
  const { queue } = useQueueList();
  const { currentClimb } = useCurrentClimb();
  const length = queue.length;
  const climbUuid = currentClimb?.uuid ?? null;

  useEffect(() => {
    if (!tour) return;
    tour.notifyQueueLength(length);
  }, [tour, length]);

  useEffect(() => {
    if (!tour) return;
    tour.notifyCurrentClimb(climbUuid);
  }, [tour, climbUuid]);

  return null;
}

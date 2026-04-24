'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useOnboardingTourOptional } from './onboarding-tour-provider';
import { TOUR_CLOSE_DUMMY_SESH_EVENT, TOUR_OPEN_DUMMY_SESH_EVENT } from './onboarding-tour-events';
import { getMockSessionDetail } from './mock-session-detail';
import type { TourStepId } from './onboarding-tour-steps';

const SeshSettingsDrawer = dynamic(() => import('@/app/components/sesh-settings/sesh-settings-drawer'), {
  ssr: false,
});

const STEP_TO_SECTION: Partial<Record<TourStepId, 'invite' | 'activity' | 'analytics'>> = {
  'sesh-invite': 'invite',
  'sesh-activity': 'activity',
  'sesh-analytics': 'analytics',
};

/**
 * Listens for the tour "open dummy sesh" event and mounts SeshSettingsDrawer
 * with a preset mock SessionDetail. Reads the current tour step to drive the
 * embedded CollapsibleSection through invite → activity → analytics.
 */
export default function OnboardingDummySeshMount() {
  const tour = useOnboardingTourOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setMounted(true);
      setOpen(true);
    };
    const handleClose = () => setOpen(false);
    window.addEventListener(TOUR_OPEN_DUMMY_SESH_EVENT, handleOpen);
    window.addEventListener(TOUR_CLOSE_DUMMY_SESH_EVENT, handleClose);
    return () => {
      window.removeEventListener(TOUR_OPEN_DUMMY_SESH_EVENT, handleOpen);
      window.removeEventListener(TOUR_CLOSE_DUMMY_SESH_EVENT, handleClose);
    };
  }, []);

  const mockSession = useMemo(() => (mounted ? getMockSessionDetail() : null), [mounted]);

  const handleDrawerClose = useCallback(() => {
    setOpen(false);
  }, []);

  const activeSection = tour?.currentStepId ? (STEP_TO_SECTION[tour.currentStepId] ?? null) : null;

  if (!mounted || !mockSession) return null;

  return (
    <SeshSettingsDrawer
      open={open}
      onClose={handleDrawerClose}
      tourMockSession={mockSession}
      tourActiveSection={activeSection}
    />
  );
}

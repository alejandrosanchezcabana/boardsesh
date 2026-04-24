'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { track } from '@vercel/analytics';
import { clearTourProgress, getTourProgress, saveOnboardingStatus, saveTourProgress } from '@/app/lib/onboarding-db';
import { PLAY_DRAWER_EVENT } from '@/app/components/queue-control/play-drawer-event';
import { dispatchClimbListSwipeHintReplay } from '@/app/components/board-page/swipe-hint-orchestrator';
import {
  TOUR_STEPS,
  type TourStepId,
  getStepById,
  getNextStepId,
  getStepIndex,
  isValidStepId,
  type StepEnterEffect,
  type StepExitEffect,
} from './onboarding-tour-steps';
import {
  dispatchTourCloseDummySesh,
  dispatchTourClosePlayQueue,
  dispatchTourClosePlayView,
  dispatchTourOpenDummySesh,
  dispatchTourOpenPlayQueue,
  dispatchTourOpenStartSesh,
} from './onboarding-tour-events';

const CURRENT_CLIMB_GRACE_MS = 1500;

const TOTAL_STEPS = TOUR_STEPS.length;
const FIRST_STEP_ID: TourStepId = TOUR_STEPS[0].id;
const LAST_STEP_ID: TourStepId = TOUR_STEPS[TOUR_STEPS.length - 1].id;

interface OnboardingTourContextValue {
  active: boolean;
  currentStepId: TourStepId | null;
  stepIndex: number;
  totalSteps: number;
  start: () => void;
  next: () => void;
  skip: () => void;
  complete: () => void;
  /** Called by a bridge component inside the graphql-queue tree when the queue changes. */
  notifyQueueLength: (length: number) => void;
  /** Called by a bridge component inside the graphql-queue tree when the current climb changes. */
  notifyCurrentClimb: (climbUuid: string | null) => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) throw new Error('useOnboardingTour must be used inside <OnboardingTourProvider>');
  return ctx;
}

/** Optional variant — returns null when used outside the provider instead of throwing. */
export function useOnboardingTourOptional(): OnboardingTourContextValue | null {
  return useContext(OnboardingTourContext);
}

function runSideEffect(effect: StepEnterEffect | StepExitEffect | undefined) {
  if (!effect) return;
  if (effect === 'open-start-sesh') dispatchTourOpenStartSesh();
  else if (effect === 'open-dummy-sesh') dispatchTourOpenDummySesh();
  else if (effect === 'close-dummy-sesh') dispatchTourCloseDummySesh();
  else if (effect === 'open-play-queue') dispatchTourOpenPlayQueue();
  else if (effect === 'close-play-queue') dispatchTourClosePlayQueue();
  else if (effect === 'close-play-view') dispatchTourClosePlayView();
  else if (effect === 'replay-climb-list-swipe-hint') {
    // Animate the first climb here — the user just set the second climb
    // active in the previous step, so direct them to queue a different one.
    dispatchClimbListSwipeHintReplay({ targetSelector: '#onboarding-climb-card' });
  }
}

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const pathname = usePathname();

  const [currentStepId, setCurrentStepId] = useState<TourStepId | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const lastQueueLengthRef = useRef<number | null>(null);
  const currentClimbUuidRef = useRef<string | null>(null);
  /** The current climb uuid captured at the moment the active step was entered. */
  const stepEntryClimbUuidRef = useRef<string | null>(null);
  const stepEnteredAtRef = useRef<number>(0);
  const hydratedRef = useRef(false);

  // Hydrate from IndexedDB on mount (per user). Do NOT auto-show the tour —
  // this only restores `currentStepId` so start() can resume.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await getTourProgress(userId);
      if (cancelled) return;
      if (progress && isValidStepId(progress.currentStepId)) {
        setCurrentStepId(progress.currentStepId);
        startedAtRef.current = progress.startedAt;
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist progress whenever the active step changes.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!currentStepId) return;
    const startedAt = startedAtRef.current ?? new Date().toISOString();
    startedAtRef.current = startedAt;
    void saveTourProgress(currentStepId, startedAt, userId);
  }, [currentStepId, userId]);

  const enterStep = useCallback(
    (stepId: TourStepId | null, fromStepId: TourStepId | null, trigger: 'next' | 'auto' | 'event') => {
      if (!stepId) return;
      const fromStep = fromStepId ? getStepById(fromStepId) : undefined;
      const nextStep = getStepById(stepId);

      // Run exit side effect for the step we're leaving.
      if (fromStep?.onExit) runSideEffect(fromStep.onExit);

      // Fire "advanced" analytics for the transition (if we came from a step).
      if (fromStepId) {
        track('Onboarding Tour Step Advanced', {
          fromStepId: fromStepId,
          toStepId: stepId,
          trigger,
        });
      }

      // Run enter side effect.
      if (nextStep?.onEnter) runSideEffect(nextStep.onEnter);

      stepEnteredAtRef.current = Date.now();
      stepEntryClimbUuidRef.current = currentClimbUuidRef.current;
      setCurrentStepId(stepId);

      // Fire "step viewed" analytics.
      track('Onboarding Tour Step Viewed', {
        stepId,
        stepIndex: getStepIndex(stepId),
        totalSteps: TOTAL_STEPS,
      });
    },
    [],
  );

  const start = useCallback(() => {
    // Tapping "Take the tour" always restarts from step 1. Any persisted
    // progress from an abandoned run is cleared so the user gets a fresh
    // walkthrough every time they tap the CTA.
    const wasInProgress = currentStepId !== null;

    track('Onboarding Tour Started', {
      resumed: false,
      restartedFrom: wasInProgress ? (currentStepId ?? '') : '',
      source: 'home-cta',
    });

    // If a previous run left side-effects open (dummy sesh drawer, nested
    // play-view queue), run its onExit so we don't inherit that state.
    if (wasInProgress && currentStepId) {
      const prevStep = getStepById(currentStepId);
      if (prevStep?.onExit) runSideEffect(prevStep.onExit);
    }
    // Also fire close events unconditionally in case the drawers were opened
    // by a step whose onExit has already run (e.g. the user navigated past
    // the final step in a previous run).
    dispatchTourCloseDummySesh();
    dispatchTourClosePlayQueue();
    dispatchTourClosePlayView();

    startedAtRef.current = new Date().toISOString();
    lastQueueLengthRef.current = null;
    stepEntryClimbUuidRef.current = null;
    void clearTourProgress(userId);
    enterStep(FIRST_STEP_ID, null, 'next');
  }, [currentStepId, userId, enterStep]);

  const advanceFrom = useCallback(
    (fromStepId: TourStepId, trigger: 'next' | 'auto' | 'event') => {
      const nextId = getNextStepId(fromStepId);
      if (!nextId) return;
      enterStep(nextId, fromStepId, trigger);
    },
    [enterStep],
  );

  const complete = useCallback(() => {
    const atStepId = currentStepId;
    if (!atStepId) return;

    const currentStep = getStepById(atStepId);
    if (currentStep?.onExit) runSideEffect(currentStep.onExit);

    const durationSeconds = startedAtRef.current
      ? Math.max(0, Math.round((Date.now() - new Date(startedAtRef.current).getTime()) / 1000))
      : 0;

    track('Onboarding Tour Completed', { durationSeconds });

    setCurrentStepId(null);
    startedAtRef.current = null;
    lastQueueLengthRef.current = null;
    void clearTourProgress(userId);
    void saveOnboardingStatus(userId);
  }, [currentStepId, userId]);

  const next = useCallback(() => {
    if (!currentStepId) return;
    if (currentStepId === LAST_STEP_ID) {
      complete();
      return;
    }
    advanceFrom(currentStepId, 'next');
  }, [currentStepId, advanceFrom, complete]);

  const skip = useCallback(() => {
    const atStepId = currentStepId;
    if (!atStepId) return;

    const currentStep = getStepById(atStepId);
    if (currentStep?.onExit) runSideEffect(currentStep.onExit);

    track('Onboarding Tour Skipped', {
      atStepId,
      stepIndex: getStepIndex(atStepId),
    });

    setCurrentStepId(null);
    startedAtRef.current = null;
    lastQueueLengthRef.current = null;
    void clearTourProgress(userId);
    void saveOnboardingStatus(userId);
  }, [currentStepId, userId]);

  // Listen for PLAY_DRAWER_EVENT to advance step queue-thumbnail → play-view.
  useEffect(() => {
    const handler = () => {
      if (currentStepId === 'queue-thumbnail') {
        advanceFrom('queue-thumbnail', 'event');
      }
    };
    window.addEventListener(PLAY_DRAWER_EVENT, handler);
    return () => window.removeEventListener(PLAY_DRAWER_EVENT, handler);
  }, [currentStepId, advanceFrom]);

  // Auto-advance home-pick-board → climb-list when the pathname changes into
  // a board list route.
  useEffect(() => {
    if (currentStepId !== 'home-pick-board') return;
    const step = getStepById('climb-list');
    if (!step) return;
    if (step.routeMatches(pathname)) {
      advanceFrom('home-pick-board', 'event');
    }
  }, [pathname, currentStepId, advanceFrom]);

  const notifyQueueLength = useCallback(
    (length: number) => {
      const prev = lastQueueLengthRef.current;
      lastQueueLengthRef.current = length;
      if (currentStepId !== 'queue-add') return;
      // Advance on the first increment after entering the step (or immediately
      // if the queue already has items when the step is entered).
      if (prev === null && length > 0) {
        advanceFrom('queue-add', 'event');
        return;
      }
      if (prev !== null && length > prev) {
        advanceFrom('queue-add', 'event');
      }
    },
    [currentStepId, advanceFrom],
  );

  const notifyCurrentClimb = useCallback(
    (climbUuid: string | null) => {
      currentClimbUuidRef.current = climbUuid;
      const step = currentStepId;
      if (step !== 'queue-bar' && step !== 'climb-list') return;

      // 'climb-list' requires the user to actively set a *different* climb
      // than the one already active on entry (so the interaction is real).
      // 'queue-bar' only requires that any climb is set.
      const hasAdvanceCondition =
        step === 'climb-list' ? climbUuid !== null && climbUuid !== stepEntryClimbUuidRef.current : climbUuid !== null;
      if (!hasAdvanceCondition) return;

      // Grace period so the user actually sees the step's copy before we
      // advance. If the grace has already elapsed, advance now.
      const elapsed = Date.now() - stepEnteredAtRef.current;
      const fire = () => {
        if (currentStepId !== step) return;
        const still =
          step === 'climb-list'
            ? currentClimbUuidRef.current !== null && currentClimbUuidRef.current !== stepEntryClimbUuidRef.current
            : currentClimbUuidRef.current !== null;
        if (still) advanceFrom(step, 'event');
      };
      if (elapsed >= CURRENT_CLIMB_GRACE_MS) {
        fire();
      } else {
        window.setTimeout(fire, CURRENT_CLIMB_GRACE_MS - elapsed);
      }
    },
    [currentStepId, advanceFrom],
  );

  // If we entered queue-bar and a climb is already set, honour the grace
  // period then advance. For climb-list we do NOT auto-advance on entry —
  // we wait for the user to set a *different* climb as active.
  useEffect(() => {
    if (currentStepId !== 'queue-bar') return;
    if (!currentClimbUuidRef.current) return;
    const step = currentStepId;
    const timer = window.setTimeout(() => {
      if (currentClimbUuidRef.current) advanceFrom(step, 'event');
    }, CURRENT_CLIMB_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [currentStepId, advanceFrom]);

  const value = useMemo<OnboardingTourContextValue>(
    () => ({
      active: currentStepId !== null,
      currentStepId,
      stepIndex: getStepIndex(currentStepId),
      totalSteps: TOTAL_STEPS,
      start,
      next,
      skip,
      complete,
      notifyQueueLength,
      notifyCurrentClimb,
    }),
    [currentStepId, start, next, skip, complete, notifyQueueLength, notifyCurrentClimb],
  );

  return <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>;
}

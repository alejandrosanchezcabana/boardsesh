import { createIndexedDBStore } from './idb-helper';

const STORE_NAME = 'onboarding';

// Increment when tour step IDs or ordering change in a breaking way that should
// invalidate any in-flight tour progress.
export const ONBOARDING_VERSION = 1;

export type OnboardingStatus = {
  completedVersion: number;
  completedAt: string;
};

export interface TourProgress {
  currentStepId: string;
  startedAt: string;
  version: number;
}

const getDB = createIndexedDBStore('boardsesh-onboarding', STORE_NAME);

const getStatusKey = (userId?: string | number | null): string =>
  userId ? `onboarding-${userId}` : 'onboarding-anonymous';

const getProgressKey = (userId?: string | number | null): string =>
  userId ? `onboarding-progress-${userId}` : 'onboarding-progress-anonymous';

export const getOnboardingStatus = async (userId?: string | number | null): Promise<OnboardingStatus | null> => {
  try {
    const db = await getDB();
    if (!db) return null;
    return await db.get(STORE_NAME, getStatusKey(userId));
  } catch (error) {
    console.error('Failed to get onboarding status:', error);
    return null;
  }
};

export const saveOnboardingStatus = async (userId?: string | number | null): Promise<void> => {
  try {
    const db = await getDB();
    if (!db) return;
    const status: OnboardingStatus = {
      completedVersion: ONBOARDING_VERSION,
      completedAt: new Date().toISOString(),
    };
    await db.put(STORE_NAME, status, getStatusKey(userId));
  } catch (error) {
    console.error('Failed to save onboarding status:', error);
  }
};

export const getTourProgress = async (userId?: string | number | null): Promise<TourProgress | null> => {
  try {
    const db = await getDB();
    if (!db) return null;
    const record = (await db.get(STORE_NAME, getProgressKey(userId))) as TourProgress | undefined;
    if (!record) return null;
    if (record.version !== ONBOARDING_VERSION) return null;
    return record;
  } catch (error) {
    console.error('Failed to get tour progress:', error);
    return null;
  }
};

export const saveTourProgress = async (
  currentStepId: string,
  startedAt: string,
  userId?: string | number | null,
): Promise<void> => {
  try {
    const db = await getDB();
    if (!db) return;
    const record: TourProgress = {
      currentStepId,
      startedAt,
      version: ONBOARDING_VERSION,
    };
    await db.put(STORE_NAME, record, getProgressKey(userId));
  } catch (error) {
    console.error('Failed to save tour progress:', error);
  }
};

export const clearTourProgress = async (userId?: string | number | null): Promise<void> => {
  try {
    const db = await getDB();
    if (!db) return;
    await db.delete(STORE_NAME, getProgressKey(userId));
  } catch (error) {
    console.error('Failed to clear tour progress:', error);
  }
};

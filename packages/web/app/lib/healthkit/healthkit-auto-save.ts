import type { SessionSummary } from '@boardsesh/shared-schema';
import {
  isHealthKitAvailable,
  requestHealthKitAuthorization,
  saveSessionToHealthKit,
  getHealthKitAutoSync,
} from './healthkit-bridge';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { SET_SESSION_HEALTHKIT_WORKOUT_ID } from '@/app/lib/graphql/operations/activity-feed';

/**
 * Standalone async function that auto-saves a session to HealthKit.
 * No React dependencies — can be called from any context.
 *
 * Returns the workoutId if save succeeded, or null if skipped/failed.
 */
export async function autoSaveToHealthKit(
  summary: SessionSummary,
  boardType: string,
  authToken: string | null,
): Promise<string | null> {
  try {
    const autoSyncEnabled = await getHealthKitAutoSync();
    if (!autoSyncEnabled) return null;

    const available = await isHealthKitAvailable();
    if (!available) return null;

    const granted = await requestHealthKitAuthorization();
    if (!granted) return null;

    const result = await saveSessionToHealthKit(summary, boardType);
    if (!result) return null;

    // Persist the workoutId to the backend for deduplication
    if (authToken) {
      try {
        const client = createGraphQLHttpClient(authToken);
        await client.request(SET_SESSION_HEALTHKIT_WORKOUT_ID, {
          sessionId: summary.sessionId,
          workoutId: result.workoutId,
        });
      } catch (e) {
        // HealthKit workout exists; backend persist failing is non-critical
        console.warn('[HealthKit] Failed to persist workout id:', e);
      }
    }

    return result.workoutId;
  } catch (e) {
    console.warn('[HealthKit] Auto-save failed:', e);
    return null;
  }
}

import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  GET_BOARDS_BY_SERIAL_NUMBERS,
  GET_MY_BOARD_SERIAL_CONFIGS,
  type BoardSerialConfig,
  type GetBoardsBySerialNumbersQueryResponse,
  type GetMyBoardSerialConfigsQueryResponse,
} from '@/app/lib/graphql/operations';
import type { UserBoard } from '@boardsesh/shared-schema';

/**
 * A serial number resolved to either a deliberately-saved `UserBoard` or — as
 * a fallback — an auto-recorded `BoardSerialConfig` from a previous connection
 * by the current user.
 */
export type ResolvedBoardEntry = { kind: 'saved'; board: UserBoard } | { kind: 'recorded'; config: BoardSerialConfig };

export type { BoardSerialConfig };

/**
 * Resolve an array of BLE serial numbers via GraphQL. Saved-board matches
 * (`boardsBySerialNumbers`) win; for authenticated callers we additionally
 * query `myBoardSerialConfigs` so any unmatched serial falls back to the
 * user's own auto-recorded config. Skipped entirely for unauthenticated
 * callers — `myBoardSerialConfigs` requires auth and the guaranteed 401
 * just pollutes telemetry / wastes a rate-limit slot.
 */
export async function resolveSerialNumbers(
  token: string,
  serials: string[],
  options: { isAuthenticated?: boolean } = {},
): Promise<Map<string, ResolvedBoardEntry>> {
  const unique = [...new Set(serials)];
  if (unique.length === 0) return new Map();

  const client = createGraphQLHttpClient(token);
  const recordedRequest = options.isAuthenticated
    ? client
        .request<GetMyBoardSerialConfigsQueryResponse>(GET_MY_BOARD_SERIAL_CONFIGS, { serialNumbers: unique })
        .catch(() => ({ myBoardSerialConfigs: [] as BoardSerialConfig[] }))
    : Promise.resolve({ myBoardSerialConfigs: [] as BoardSerialConfig[] });

  const [savedResult, recordedResult] = await Promise.all([
    client
      .request<GetBoardsBySerialNumbersQueryResponse>(GET_BOARDS_BY_SERIAL_NUMBERS, {
        serialNumbers: unique,
      })
      .catch(() => ({ boardsBySerialNumbers: [] as UserBoard[] })),
    recordedRequest,
  ]);

  const result = new Map<string, ResolvedBoardEntry>();
  for (const board of savedResult.boardsBySerialNumbers) {
    if (board.serialNumber) {
      result.set(board.serialNumber, { kind: 'saved', board });
    }
  }
  for (const config of recordedResult.myBoardSerialConfigs) {
    if (!result.has(config.serialNumber)) {
      result.set(config.serialNumber, { kind: 'recorded', config });
    }
  }
  return result;
}

import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { GET_BOARDS_BY_SERIAL_NUMBERS, type GetBoardsBySerialNumbersQueryResponse } from '@/app/lib/graphql/operations';
import type { UserBoard } from '@boardsesh/shared-schema';

/**
 * Resolve an array of BLE serial numbers to known boards via GraphQL.
 * Returns a Map keyed by serial number.
 */
export async function resolveSerialNumbers(token: string, serials: string[]): Promise<Map<string, UserBoard>> {
  const unique = [...new Set(serials)];
  if (unique.length === 0) return new Map();

  const client = createGraphQLHttpClient(token);
  const data = await client.request<GetBoardsBySerialNumbersQueryResponse>(GET_BOARDS_BY_SERIAL_NUMBERS, {
    serialNumbers: unique,
  });

  const boardMap = new Map<string, UserBoard>();
  for (const board of data.boardsBySerialNumbers) {
    if (board.serialNumber) {
      boardMap.set(board.serialNumber, board);
    }
  }
  return boardMap;
}

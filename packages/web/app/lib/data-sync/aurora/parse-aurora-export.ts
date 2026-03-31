/**
 * Utilities for parsing and preparing Aurora JSON export files for import.
 */

export interface AuroraExportPreview {
  ascents: number;
  attempts: number;
  circuits: number;
  climbs: number;
  username: string;
}

export interface StrippedExportData {
  user: { username: string; email_address?: string; created_at?: string };
  ascents: unknown[];
  attempts: unknown[];
  circuits: unknown[];
  climbs: unknown[];
}

export interface ParsedExportResult {
  data: StrippedExportData;
  preview: AuroraExportPreview;
  boardWarning?: string;
}

/**
 * Parses an Aurora JSON export, validates required fields, strips heavy unused
 * fields (walls, blocks, etc.), and returns the data ready for import.
 *
 * @throws {Error} If the JSON is missing required user data.
 */
export function parseAuroraExport(
  json: Record<string, unknown>,
  boardType: 'kilter' | 'tension',
): ParsedExportResult {
  const user = json.user as { username?: string; email_address?: string; created_at?: string } | undefined;

  if (!user?.username) {
    throw new Error('Invalid file: missing user data. Please select an Aurora JSON export file.');
  }

  // Check if the export's board type matches the target board
  let boardWarning: string | undefined;
  const climbs = json.climbs;
  if (Array.isArray(climbs) && climbs.length > 0) {
    const layout = (climbs[0]?.layout as string | undefined)?.toLowerCase() ?? '';
    const boardName = boardType.charAt(0).toUpperCase() + boardType.slice(1);
    const layoutMatchesBoard =
      (boardType === 'kilter' && layout.includes('kilter')) ||
      (boardType === 'tension' && layout.includes('tension'));

    if (!layoutMatchesBoard && layout) {
      boardWarning = `Warning: This export appears to be from "${climbs[0].layout}" but you're importing to ${boardName}. Climbs may not match.`;
    }
  }

  const ascents = Array.isArray(json.ascents) ? (json.ascents as unknown[]) : [];
  const attempts = Array.isArray(json.attempts) ? (json.attempts as unknown[]) : [];
  const circuits = Array.isArray(json.circuits) ? (json.circuits as unknown[]) : [];
  const userClimbs = Array.isArray(json.climbs) ? (json.climbs as unknown[]) : [];

  return {
    data: {
      user: user as StrippedExportData['user'],
      ascents,
      attempts,
      circuits,
      climbs: userClimbs,
    },
    preview: {
      ascents: ascents.length,
      attempts: attempts.length,
      circuits: circuits.length,
      climbs: userClimbs.length,
      username: user.username,
    },
    boardWarning,
  };
}

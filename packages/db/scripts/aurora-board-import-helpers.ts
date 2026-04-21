export const DIRECT_AURORA_BOARDS = ["decoy", "touchstone", "grasshopper"] as const;

export type DirectAuroraBoard = (typeof DIRECT_AURORA_BOARDS)[number];
export type ImportedHoldState = "STARTING" | "HAND" | "FINISH" | "FOOT" | "OFF";

export interface SourceClimbRow {
  uuid: string;
  frames: string | null;
}

export interface SourceClimbHoldRow {
  climb_uuid: string | null;
  hold_id: number | null;
  frame_number: number | null;
  hold_state: string | null;
  created_at?: string | null;
}

export interface DerivedClimbHold {
  climbUuid: string;
  holdId: number;
  frameNumber: number;
  holdState: ImportedHoldState;
}

const AURORA_HOLD_STATE_MAP: Record<DirectAuroraBoard, Record<number, ImportedHoldState>> = {
  decoy: {
    1: "STARTING",
    2: "HAND",
    3: "FINISH",
    4: "FOOT",
  },
  touchstone: {
    1: "STARTING",
    2: "HAND",
    3: "FINISH",
    4: "FOOT",
  },
  grasshopper: {
    1: "STARTING",
    2: "HAND",
    3: "FINISH",
    4: "FOOT",
  },
};

const HOLD_STATE_PRIORITY: Record<ImportedHoldState, number> = {
  OFF: 0,
  FOOT: 1,
  HAND: 2,
  FINISH: 3,
  STARTING: 4,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asImportedHoldState(value: string | null | undefined): ImportedHoldState | null {
  if (!value) {
    return null;
  }

  if (
    value === "STARTING" ||
    value === "HAND" ||
    value === "FINISH" ||
    value === "FOOT" ||
    value === "OFF"
  ) {
    return value;
  }

  return null;
}

function choosePreferredHold(
  existing: DerivedClimbHold | undefined,
  candidate: DerivedClimbHold,
): DerivedClimbHold {
  if (!existing) {
    return candidate;
  }

  const existingPriority = HOLD_STATE_PRIORITY[existing.holdState];
  const candidatePriority = HOLD_STATE_PRIORITY[candidate.holdState];

  if (candidatePriority > existingPriority) {
    return candidate;
  }

  if (candidatePriority < existingPriority) {
    return existing;
  }

  return candidate.frameNumber < existing.frameNumber ? candidate : existing;
}

export function deriveClimbHoldsFromFrames(
  climb: SourceClimbRow,
  boardName: DirectAuroraBoard,
): DerivedClimbHold[] {
  if (!climb.frames) {
    return [];
  }

  const holdMap = new Map<number, DerivedClimbHold>();
  const frames = climb.frames.split(",");

  frames.forEach((framePart, frameIndex) => {
    for (const token of framePart.split("p")) {
      if (!token || token === '""') {
        continue;
      }

      const match = token.match(/^(\d+)([rx])(\d+)$/);
      if (!match) {
        continue;
      }

      const [, holdIdRaw, marker, stateRaw] = match;
      const holdId = Number(holdIdRaw);

      if (!Number.isFinite(holdId)) {
        continue;
      }

      let holdState: ImportedHoldState | null = null;

      if (marker === "x") {
        holdState = "OFF";
      } else {
        holdState = AURORA_HOLD_STATE_MAP[boardName][Number(stateRaw)] ?? null;
      }

      if (!holdState) {
        continue;
      }

      const candidate: DerivedClimbHold = {
        climbUuid: climb.uuid,
        holdId,
        frameNumber: frameIndex,
        holdState,
      };

      holdMap.set(holdId, choosePreferredHold(holdMap.get(holdId), candidate));
    }
  });

  return Array.from(holdMap.values()).sort(
    (left, right) => left.holdId - right.holdId || left.frameNumber - right.frameNumber,
  );
}

export function dedupeSourceClimbHolds(rows: SourceClimbHoldRow[]): DerivedClimbHold[] {
  const normalized = rows
    .map((row, index) => {
      const climbUuid = row.climb_uuid ?? null;
      const holdId = toNumber(row.hold_id);
      const frameNumber = toNumber(row.frame_number);
      const holdState = asImportedHoldState(row.hold_state);

      if (!climbUuid || holdId === null || frameNumber === null || !holdState) {
        return null;
      }

      return {
        climbUuid,
        holdId,
        frameNumber,
        holdState,
        createdAt: row.created_at ?? null,
        index,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => {
      if (left.climbUuid !== right.climbUuid) {
        return left.climbUuid.localeCompare(right.climbUuid);
      }

      if (left.holdId !== right.holdId) {
        return left.holdId - right.holdId;
      }

      const leftCreatedAt = left.createdAt ?? "";
      const rightCreatedAt = right.createdAt ?? "";

      if (leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt.localeCompare(leftCreatedAt);
      }

      return right.index - left.index;
    });

  const deduped: DerivedClimbHold[] = [];
  const seen = new Set<string>();

  for (const row of normalized) {
    const key = `${row.climbUuid}:${row.holdId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      climbUuid: row.climbUuid,
      holdId: row.holdId,
      frameNumber: row.frameNumber,
      holdState: row.holdState,
    });
  }

  return deduped;
}

import { describe, it, expect } from "vite-plus/test";
import { parseClimbFrameHoldIds, canAddClimbToBoard } from "@/app/lib/board-compatibility";
import type { Climb, BoardDetails } from "@/app/lib/types";

function holdsData(ids: number[]): BoardDetails["holdsData"] {
  return ids.map((id) => ({ id, mirroredHoldId: null, cx: 0, cy: 0, r: 1 }));
}

function makeBoard(partial: Partial<BoardDetails>): BoardDetails {
  return {
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 0,
    boardWidth: 0,
    board_name: "kilter",
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    ...partial,
  };
}

function makeClimb(partial: Partial<Climb>): Climb {
  return {
    uuid: "climb-uuid",
    setter_username: "test",
    name: "Test",
    frames: "",
    angle: 40,
    ascensionist_count: 0,
    difficulty: "",
    quality_average: "",
    stars: 0,
    difficulty_error: "",
    benchmark_difficulty: null,
    ...partial,
  };
}

describe("parseClimbFrameHoldIds", () => {
  it("returns an empty array for empty or nullish input", () => {
    expect(parseClimbFrameHoldIds("")).toEqual([]);
    expect(parseClimbFrameHoldIds(null)).toEqual([]);
    expect(parseClimbFrameHoldIds(undefined)).toEqual([]);
  });

  it("parses a single hold", () => {
    expect(parseClimbFrameHoldIds("p1234r15")).toEqual([1234]);
  });

  it("parses multiple holds", () => {
    expect(parseClimbFrameHoldIds("p1234r15p5678r12p9r14")).toEqual([1234, 5678, 9]);
  });

  it("handles negative state codes", () => {
    expect(parseClimbFrameHoldIds("p100r-1p200r15")).toEqual([100, 200]);
  });

  it("returns an empty array for malformed input", () => {
    expect(parseClimbFrameHoldIds("hello world")).toEqual([]);
  });
});

describe("canAddClimbToBoard", () => {
  it("allows a climb that fits on the target board", () => {
    const board = makeBoard({ holdsData: holdsData([1, 2, 3, 4, 5]) });
    const climb = makeClimb({ frames: "p1r15p3r12p5r14" });
    expect(canAddClimbToBoard(climb, board)).toEqual({ ok: true });
  });

  it("rejects climbs from a different board_name", () => {
    const board = makeBoard({ board_name: "kilter" });
    const climb = makeClimb({ boardType: "tension", frames: "p1r15" });
    expect(canAddClimbToBoard(climb, board)).toEqual({ ok: false, reason: "board_name" });
  });

  it("rejects climbs from a different layout_id", () => {
    const board = makeBoard({ layout_id: 1, holdsData: holdsData([1, 2]) });
    const climb = makeClimb({ layoutId: 7, frames: "p1r15" });
    expect(canAddClimbToBoard(climb, board)).toEqual({ ok: false, reason: "layout" });
  });

  it("ignores missing boardType / layoutId on legacy climbs", () => {
    const board = makeBoard({ holdsData: holdsData([1, 2]) });
    const climb = makeClimb({ frames: "p1r15p2r14" });
    expect(canAddClimbToBoard(climb, board)).toEqual({ ok: true });
  });

  it("allows a smaller-board climb on a larger board (subset of holds)", () => {
    const smallBoard = makeBoard({ size_id: 1, holdsData: holdsData([1, 2, 3, 4]) });
    const largeBoard = makeBoard({ size_id: 2, holdsData: holdsData([1, 2, 3, 4, 5, 6, 7, 8]) });
    // Pretend this climb was set on the small board.
    const climb = makeClimb({ frames: "p1r15p3r12p4r14" });
    expect(canAddClimbToBoard(climb, largeBoard)).toEqual({ ok: true });
    // And adding it back to the small board still works.
    expect(canAddClimbToBoard(climb, smallBoard)).toEqual({ ok: true });
  });

  it("rejects a larger-board climb on a smaller board when it uses out-of-range holds", () => {
    const smallBoard = makeBoard({ size_id: 1, holdsData: holdsData([1, 2, 3, 4]) });
    // A climb that uses a hold (7) not present on the small board.
    const climb = makeClimb({ frames: "p1r15p3r12p7r14" });
    expect(canAddClimbToBoard(climb, smallBoard)).toEqual({
      ok: false,
      reason: "holds_out_of_range",
    });
  });

  it("treats empty frames as compatible", () => {
    const board = makeBoard({ holdsData: holdsData([1, 2, 3]) });
    const climb = makeClimb({ frames: "" });
    expect(canAddClimbToBoard(climb, board)).toEqual({ ok: true });
  });
});

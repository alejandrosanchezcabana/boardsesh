import { describe, it, expect } from "vite-plus/test";
import type { BoardDetails } from "@/app/lib/types";
import type { HoldRenderData } from "@/app/components/board-renderer/types";
import { computeCropTop } from "../worker-manager";

function makeBoardDetails(holds: HoldRenderData[], boardWidth = 1000): BoardDetails {
  return {
    board_name: "kilter",
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    boardWidth,
    boardHeight: 1500,
    holdsData: holds,
    images_to_holds: {},
    edge_left: 0,
    edge_right: boardWidth,
    edge_bottom: 1500,
    edge_top: 0,
    layout_name: "Original",
    size_name: "Full",
    size_description: "Full",
    set_names: ["Standard"],
    supportsMirroring: false,
  } as BoardDetails;
}

function makeHold(cy: number, r: number, id = 1): HoldRenderData {
  return { id, mirroredHoldId: null, cx: 500, cy, r };
}

describe("computeCropTop", () => {
  it("returns 0 when there are no holds", () => {
    const bd = makeBoardDetails([]);
    expect(computeCropTop(bd, 1000)).toBe(0);
  });

  it("crops to the topmost hold edge (cy - r)", () => {
    const holds = [
      makeHold(300, 20, 1), // top edge = 280
      makeHold(500, 30, 2), // top edge = 470
      makeHold(100, 10, 3), // top edge = 90 ← topmost
    ];
    const bd = makeBoardDetails(holds, 1000);
    // scale = 1000/1000 = 1, floor(90 * 1) = 90
    expect(computeCropTop(bd, 1000)).toBe(90);
  });

  it("scales crop by outputWidth / boardWidth", () => {
    const holds = [makeHold(200, 20, 1)]; // top edge = 180
    const bd = makeBoardDetails(holds, 1000);
    // scale = 500/1000 = 0.5, floor(180 * 0.5) = 90
    expect(computeCropTop(bd, 500)).toBe(90);
  });

  it("floors the result to whole pixels", () => {
    const holds = [makeHold(100, 7, 1)]; // top edge = 93
    const bd = makeBoardDetails(holds, 1000);
    // scale = 800/1000 = 0.8, floor(93 * 0.8) = floor(74.4) = 74
    expect(computeCropTop(bd, 800)).toBe(74);
  });

  it("clamps to 0 when topmost hold edge is negative", () => {
    const holds = [makeHold(5, 20, 1)]; // top edge = -15
    const bd = makeBoardDetails(holds, 1000);
    // Math.max(0, floor(-15 * 1)) = 0
    expect(computeCropTop(bd, 1000)).toBe(0);
  });

  it("handles a single hold at the very top", () => {
    const holds = [makeHold(10, 10, 1)]; // top edge = 0
    const bd = makeBoardDetails(holds, 1000);
    expect(computeCropTop(bd, 1000)).toBe(0);
  });

  it("handles scale > 1 (output wider than board)", () => {
    const holds = [makeHold(100, 10, 1)]; // top edge = 90
    const bd = makeBoardDetails(holds, 500);
    // scale = 1000/500 = 2, floor(90 * 2) = 180
    expect(computeCropTop(bd, 1000)).toBe(180);
  });
});

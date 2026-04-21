import { describe, it, expect } from "vite-plus/test";
import type { Climb } from "@/app/lib/types";
import { isClimbEditable } from "../is-climb-editable";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FIXED_NOW = Date.parse("2026-04-12T12:00:00Z");

function makeClimb(overrides: Partial<Climb> = {}): Climb {
  return {
    uuid: "climb-1",
    setter_username: "alice",
    userId: "user-alice",
    name: "Test Climb",
    description: "",
    frames: "p1r14",
    angle: 40,
    ascensionist_count: 0,
    difficulty: "",
    quality_average: "0",
    stars: 0,
    difficulty_error: "0",
    benchmark_difficulty: null,
    is_draft: false,
    published_at: new Date(FIXED_NOW - ONE_HOUR_MS).toISOString(),
    ...overrides,
  };
}

describe("isClimbEditable", () => {
  it("returns false when there is no board-slug route", () => {
    const climb = makeClimb({ is_draft: true });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: false,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false when the user is not signed in", () => {
    const climb = makeClimb({ is_draft: true });
    expect(
      isClimbEditable(climb, {
        currentUserId: null,
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
    expect(
      isClimbEditable(climb, {
        currentUserId: undefined,
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns true for a draft owned by the signed-in user", () => {
    const climb = makeClimb({
      is_draft: true,
      published_at: null,
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(true);
  });

  it("returns true for a published climb still inside the 24h window", () => {
    const climb = makeClimb({
      is_draft: false,
      published_at: new Date(FIXED_NOW - 23 * ONE_HOUR_MS).toISOString(),
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(true);
  });

  it("returns true at the exact 24h edit boundary", () => {
    const climb = makeClimb({
      is_draft: false,
      published_at: new Date(FIXED_NOW - ONE_DAY_MS).toISOString(),
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(true);
  });

  it("returns false once the 24h window has lapsed", () => {
    const climb = makeClimb({
      is_draft: false,
      published_at: new Date(FIXED_NOW - ONE_DAY_MS - 1).toISOString(),
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false for a published climb with no published_at timestamp", () => {
    const climb = makeClimb({
      is_draft: false,
      published_at: null,
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false for a malformed published_at timestamp", () => {
    const climb = makeClimb({
      is_draft: false,
      published_at: "not-a-date",
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false when the climb belongs to a different user", () => {
    const climb = makeClimb({
      is_draft: true,
      userId: "user-bob",
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false when the climb has no userId (Aurora-synced)", () => {
    const climb = makeClimb({
      is_draft: true,
      userId: null,
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns false when userId is undefined", () => {
    const climb = makeClimb({ is_draft: true });
    delete (climb as { userId?: unknown }).userId;
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("ignores setter_username for ownership — two users with same username do not leak Edit", () => {
    // Regression: the legacy gate compared setter_username to the signed-in
    // user's username. A peer who happens to share a display name with the
    // setter would have passed that check. With userId-based ownership the
    // gate stays tight even when usernames collide.
    const climb = makeClimb({
      is_draft: true,
      setter_username: "alice",
      userId: "user-bob",
    });
    expect(
      isClimbEditable(climb, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });

  it("returns true even if setter_username is empty, as long as userId matches", () => {
    // Regression: the legacy gate short-circuited when setter_username was
    // falsy, so any signed-in user saw Edit on climbs with a blank username.
    // The userId-based gate correctly scopes editability to the real owner.
    const climbOwned = makeClimb({
      is_draft: true,
      setter_username: "",
      userId: "user-alice",
    });
    expect(
      isClimbEditable(climbOwned, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(true);

    const climbOther = makeClimb({
      is_draft: true,
      setter_username: "",
      userId: "user-bob",
    });
    expect(
      isClimbEditable(climbOther, {
        currentUserId: "user-alice",
        hasBoardRoute: true,
        now: FIXED_NOW,
      }),
    ).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const sessionFeedTestState = vi.hoisted(() => {
  const executeMock = vi.fn();
  const selectWhereMock = vi.fn();
  const selectFromMock = vi.fn(() => ({
    where: selectWhereMock,
  }));
  const selectMock = vi.fn(() => ({
    from: selectFromMock,
  }));

  return {
    executeMock,
    selectWhereMock,
    selectFromMock,
    selectMock,
  };
});

vi.mock("../db/client", () => ({
  db: {
    execute: sessionFeedTestState.executeMock,
    select: sessionFeedTestState.selectMock,
  },
}));

const { sessionGroupedFeed } = await import("../graphql/resolvers/social/session-feed").then(
  (module) => module.sessionFeedQueries,
);

function sqlToText(query: unknown): string {
  const sqlQuery = query as { queryChunks?: Array<{ value?: string[] }> };
  return (sqlQuery.queryChunks || [])
    .map((chunk) => (Array.isArray(chunk?.value) ? chunk.value.join("") : ""))
    .join("");
}

describe("sessionGroupedFeed user filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionFeedTestState.executeMock
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: "party-1",
            session_type: "party",
            session_first_tick: "2024-01-15T10:00:00.000Z",
            session_last_tick: "2024-01-15T12:00:00.000Z",
            tick_count: 8,
            total_sends: 5,
            total_flashes: 2,
            total_attempts: 6,
            vote_score: 4,
            vote_up: 5,
            vote_down: 1,
            comment_count: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            effective_session_id: "party-1",
            userId: "user-1",
            displayName: "Alex",
            avatarUrl: null,
            sends: 3,
            flashes: 1,
            attempts: 2,
          },
          {
            effective_session_id: "party-1",
            userId: "user-2",
            displayName: "Sam",
            avatarUrl: null,
            sends: 2,
            flashes: 1,
            attempts: 4,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            effective_session_id: "party-1",
            diff_num: 10,
            flash: 2,
            send: 3,
            attempt: 6,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            effective_session_id: "party-1",
            board_types: ["kilter"],
          },
        ],
      });

    sessionFeedTestState.selectWhereMock.mockResolvedValue([
      {
        id: "party-1",
        name: "Lunch Laps",
        goal: "Finish the set",
        createdByUserId: "user-1",
      },
    ]);
  });

  it("filters party sessions by participant but returns whole-session aggregates", async () => {
    const result = await sessionGroupedFeed(null, {
      input: {
        userId: "user-1",
        limit: 20,
      },
    });

    const mainQueryText = sqlToText(sessionFeedTestState.executeMock.mock.calls[0][0]);

    expect(mainQueryText).toContain("eligible_party_sessions");
    expect(mainQueryText).toContain(
      "INNER JOIN eligible_party_sessions eps ON eps.session_id = t.session_id",
    );

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      sessionId: "party-1",
      totalSends: 5,
      totalFlashes: 2,
      totalAttempts: 6,
      hardestGrade: "V5",
      participants: [
        expect.objectContaining({ userId: "user-1", sends: 3 }),
        expect.objectContaining({ userId: "user-2", sends: 2 }),
      ],
    });
  });
});

import { describe, it, expect } from "vite-plus/test";
import { generateSessionName } from "../session-utils";

describe("generateSessionName", () => {
  it("returns day + capitalized board type", () => {
    // 2024-06-03 is a Monday
    expect(generateSessionName("2024-06-03T10:00:00Z", ["kilter"])).toBe("Monday Kilter Session");
  });

  it("joins multiple board types with &", () => {
    expect(generateSessionName("2024-06-03T10:00:00Z", ["kilter", "tension"])).toBe(
      "Monday Kilter & Tension Session",
    );
  });

  it("capitalizes first letter of each board type", () => {
    expect(generateSessionName("2024-06-07T10:00:00Z", ["moonboard"])).toBe(
      "Friday Moonboard Session",
    );
  });

  it("handles Sunday correctly", () => {
    // 2024-06-02 is a Sunday
    expect(generateSessionName("2024-06-02T10:00:00Z", ["tension"])).toBe("Sunday Tension Session");
  });

  it("handles Saturday correctly", () => {
    // 2024-06-08 is a Saturday — use midday UTC to avoid timezone edge
    expect(generateSessionName("2024-06-08T12:00:00Z", ["kilter"])).toBe("Saturday Kilter Session");
  });
});

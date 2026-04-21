import { describe, it, expect } from "vite-plus/test";
import { formatElapsed } from "../use-session-timer";

describe("formatElapsed", () => {
  describe("long format (hh:mm:ss)", () => {
    it("formats zero seconds", () => {
      expect(formatElapsed(0)).toBe("00:00:00");
    });

    it("formats seconds only", () => {
      expect(formatElapsed(45)).toBe("00:00:45");
    });

    it("formats minutes and seconds", () => {
      expect(formatElapsed(125)).toBe("00:02:05");
    });

    it("formats hours, minutes, and seconds", () => {
      expect(formatElapsed(3661)).toBe("01:01:01");
    });

    it("handles large values", () => {
      // 10 hours, 30 minutes, 15 seconds
      expect(formatElapsed(37815)).toBe("10:30:15");
    });
  });

  describe("short format (hh:mm)", () => {
    it("formats zero seconds", () => {
      expect(formatElapsed(0, true)).toBe("00:00");
    });

    it("drops seconds", () => {
      expect(formatElapsed(45, true)).toBe("00:00");
    });

    it("formats minutes", () => {
      expect(formatElapsed(125, true)).toBe("00:02");
    });

    it("formats hours and minutes", () => {
      expect(formatElapsed(3661, true)).toBe("01:01");
    });
  });
});

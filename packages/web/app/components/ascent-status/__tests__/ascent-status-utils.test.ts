import { describe, expect, it } from "vite-plus/test";
import { normalizeAscentStatus, pickHighestAscentStatus } from "../ascent-status-utils";

describe("normalizeAscentStatus", () => {
  it("returns explicit flash status unchanged", () => {
    expect(normalizeAscentStatus({ status: "flash", isAscent: false, tries: 4 })).toBe("flash");
  });

  it("returns explicit send status unchanged", () => {
    expect(normalizeAscentStatus({ status: "send", isAscent: true, tries: 1 })).toBe("send");
  });

  it("falls back to flash for first-try ascents", () => {
    expect(normalizeAscentStatus({ isAscent: true, tries: 1 })).toBe("flash");
  });

  it("falls back to send for successful non-flash ascents", () => {
    expect(normalizeAscentStatus({ isAscent: true, tries: 3 })).toBe("send");
  });

  it("falls back to attempt for unsuccessful ascents", () => {
    expect(normalizeAscentStatus({ isAscent: false, tries: 2 })).toBe("attempt");
  });
});

describe("pickHighestAscentStatus", () => {
  it("prefers flash over send and attempt", () => {
    expect(pickHighestAscentStatus(["attempt", "send", "flash"])).toBe("flash");
  });

  it("returns null when no statuses are present", () => {
    expect(pickHighestAscentStatus([])).toBeNull();
  });
});

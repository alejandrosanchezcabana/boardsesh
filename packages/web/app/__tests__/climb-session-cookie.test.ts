import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  CLIMB_SESSION_COOKIE,
  getClimbSessionCookie,
  setClimbSessionCookie,
  clearClimbSessionCookie,
} from "@/app/lib/climb-session-cookie";

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

beforeEach(() => {
  // Clear all cookies
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
});

describe("CLIMB_SESSION_COOKIE", () => {
  it("is boardsesh-climb-session-id", () => {
    expect(CLIMB_SESSION_COOKIE).toBe("boardsesh-climb-session-id");
  });
});

describe("setClimbSessionCookie", () => {
  it("sets a cookie with the session ID", () => {
    setClimbSessionCookie("abc-123");
    expect(getCookieValue(CLIMB_SESSION_COOKIE)).toBe("abc-123");
  });

  it("overwrites a previous value", () => {
    setClimbSessionCookie("first");
    setClimbSessionCookie("second");
    expect(getCookieValue(CLIMB_SESSION_COOKIE)).toBe("second");
  });

  it("encodes special characters", () => {
    setClimbSessionCookie("id with spaces & stuff");
    expect(getCookieValue(CLIMB_SESSION_COOKIE)).toBe("id with spaces & stuff");
  });
});

describe("getClimbSessionCookie", () => {
  it("returns null when cookie is not set", () => {
    expect(getClimbSessionCookie()).toBeNull();
  });

  it("returns the session ID when cookie is set", () => {
    setClimbSessionCookie("my-session");
    expect(getClimbSessionCookie()).toBe("my-session");
  });

  it("decodes URI-encoded values", () => {
    setClimbSessionCookie("a%b");
    expect(getClimbSessionCookie()).toBe("a%b");
  });

  it("does not return other cookies", () => {
    document.cookie = "other-cookie=nope; path=/";
    expect(getClimbSessionCookie()).toBeNull();
  });
});

describe("clearClimbSessionCookie", () => {
  it("removes the cookie", () => {
    setClimbSessionCookie("to-delete");
    expect(getClimbSessionCookie()).toBe("to-delete");

    clearClimbSessionCookie();
    expect(getClimbSessionCookie()).toBeNull();
  });

  it("is safe to call when no cookie exists", () => {
    clearClimbSessionCookie();
    expect(getClimbSessionCookie()).toBeNull();
  });
});

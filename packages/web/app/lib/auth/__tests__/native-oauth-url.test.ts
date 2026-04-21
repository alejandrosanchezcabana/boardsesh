import { describe, expect, it } from "vite-plus/test";
import { buildNativeOAuthSignInUrl } from "../native-oauth-url";

describe("buildNativeOAuthSignInUrl", () => {
  it("builds a native-start URL with provider and callback", () => {
    const url = buildNativeOAuthSignInUrl({
      origin: "https://boardsesh.com",
      provider: "google",
      callbackPath: "/settings",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/auth/native-start");
    expect(parsed.searchParams.get("provider")).toBe("google");
    expect(parsed.searchParams.get("callbackUrl")).toBe(
      "https://boardsesh.com/api/auth/native/callback?next=%2Fsettings",
    );
  });

  it("normalizes non-relative callback path values", () => {
    const url = buildNativeOAuthSignInUrl({
      origin: "https://boardsesh.com",
      provider: "apple",
      callbackPath: "https://example.com/evil",
    });

    const parsed = new URL(url);
    const callbackUrl = parsed.searchParams.get("callbackUrl")!;
    expect(callbackUrl).toContain("next=%2F");
    expect(callbackUrl).not.toContain("evil");
  });

  it("passes provider name as a query param (no path traversal risk)", () => {
    const url = buildNativeOAuthSignInUrl({
      origin: "https://boardsesh.com",
      provider: "../admin",
      callbackPath: "/",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/auth/native-start");
    expect(parsed.searchParams.get("provider")).toBe("../admin");
  });
});

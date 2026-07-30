// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("@/app/auth/callback/route");

const VALID_CODE = "pkce-code-that-works";

function callback(query: string): NextRequest {
  return new NextRequest(`https://slimruimte.nl/auth/callback${query}`);
}

/** `location` of the redirect, relative to the origin, for readable assertions. */
function destination(response: Response): string {
  return new URL(response.headers.get("location")!).href.replace(
    "https://slimruimte.nl",
    "",
  );
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockImplementation(async (code: string) =>
    code === VALID_CODE
      ? { data: { session: {} }, error: null }
      : { data: { session: null }, error: { message: "invalid flow state" } },
  );
});

describe("GET /auth/callback", () => {
  it("exchanges a valid code and redirects to /dashboard", async () => {
    const response = await GET(callback(`?code=${VALID_CODE}`));

    expect(response.status).toBe(307);
    expect(destination(response)).toBe("/dashboard");
    expect(exchangeCodeForSession).toHaveBeenCalledWith(VALID_CODE);
  });

  it("redirects to the login page with an error when no code is present", async () => {
    const response = await GET(callback(""));

    expect(destination(response)).toBe("/auth/login?error=auth_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to the login page with an error when the code is invalid", async () => {
    const response = await GET(callback("?code=expired-or-forged"));

    expect(destination(response)).toBe("/auth/login?error=auth_failed");
  });

  it("does not attempt an exchange when Supabase reported an error upstream", async () => {
    const response = await GET(
      callback("?error=access_denied&error_description=User%20denied"),
    );

    expect(destination(response)).toBe("/auth/login?error=auth_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("honours a relative ?next= so a magic link resumes where the user left off", async () => {
    const response = await GET(
      callback(`?code=${VALID_CODE}&next=%2Fhomeowner%2Fproject%2Fnew`),
    );

    expect(destination(response)).toBe("/homeowner/project/new");
  });

  describe("open redirect", () => {
    it.each([
      ["https://evil.example/steal", "absolute url"],
      ["//evil.example/steal", "protocol-relative url"],
      ["http://evil.example", "plain http host"],
      ["javascript:alert(1)", "javascript scheme"],
      ["evil.example", "bare host"],
    ])("ignores ?next=%s (%s) and falls back to /dashboard", async (next) => {
      const response = await GET(
        callback(`?code=${VALID_CODE}&next=${encodeURIComponent(next)}`),
      );

      expect(destination(response)).toBe("/dashboard");
      expect(response.headers.get("location")).toContain("slimruimte.nl");
      expect(response.headers.get("location")).not.toContain("evil.example");
    });
  });
});

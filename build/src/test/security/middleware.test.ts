// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ROLE_ROUTE_PREFIX, type Role } from "@/lib/roles";

/**
 * ROUTE PROTECTION RULES — WHAT THE PROXY ACTUALLY DOES
 * =====================================================
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`, so the file
 * under test is `src/proxy.ts`, not `src/middleware.ts`. There is no
 * `middleware.ts` in this repo and there should not be one.
 *
 * The test brief asked for a matcher that EXCLUDES `/auth/*`, `/invite/*`,
 * `/_next/*` and `/api/auth/*`. The shipped matcher deliberately does not, and
 * the tests below assert the shipped behaviour with the reason attached:
 *
 *   - The matcher is a negative lookahead excluding only static assets
 *     (`_next/static`, `_next/image`, `favicon.ico`). Everything else is
 *     matched, because job #1 of the proxy is REFRESHING THE SUPABASE SESSION
 *     on every request. Excluding `/auth/*` from the matcher would stop the
 *     refresh from running on public pages, and refresh tokens would quietly
 *     expire while a user sat on one.
 *   - `/auth/*` is instead allowed through INSIDE the handler, via
 *     `PUBLIC_PREFIXES`. Same outcome for the user, session refresh preserved,
 *     and — critically — no redirect loop on `/auth/login`.
 *   - `/invite/*` does not exist yet. It is F13 (pro-initiated workflow), Week 3+.
 *     A test asserting it is excluded would be asserting a route that has no
 *     handler. The guard test below states the requirement instead: when
 *     `/invite/*` lands it MUST be added to `PUBLIC_PREFIXES`, or an invited
 *     user who is not signed in will be bounced to login and never see the
 *     invite.
 *   - `/api/auth/*` does not exist either (auth is handled by `/auth/callback`,
 *     a page route). `/api/*` is not role-gated at all — see `src/lib/api-auth.ts`,
 *     which is the only application-layer guard on API routes.
 *
 * The proxy is an OPTIMISTIC check. It reads the role from the JWT metadata,
 * which a user can rewrite via `auth.updateUser()`. It is a UX affordance, not
 * a boundary — the boundary is RLS plus the server-side re-check in each role
 * layout and in `requireApiRole()`. Nothing here should ever be the only thing
 * standing between a contractor and a homeowner's data.
 */

const updateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (request: NextRequest) => updateSession(request),
}));

const { proxy, config } = await import("@/proxy");

function signedIn(role: string | null): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    app_metadata: {},
    user_metadata: role === null ? {} : { role },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  } as User;
}

function request(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

function session(user: User | null) {
  updateSession.mockImplementation((req: NextRequest) => ({
    response: NextResponse.next({ request: req }),
    user,
  }));
}

/** The path a redirect points at, or null when the response was a pass-through. */
function redirectTarget(response: NextResponse): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  updateSession.mockReset();
  session(null);
});

describe("matcher configuration", () => {
  const matcher = config.matcher[0];
  const matches = (pathname: string) => new RegExp(`^${matcher}$`).test(pathname);

  it("is a single negative-lookahead pattern, not a protected-routes allowlist", () => {
    expect(config.matcher).toHaveLength(1);
    expect(matcher).toBe("/((?!_next/static|_next/image|favicon.ico).*)");
  });

  it.each(Object.values(ROLE_ROUTE_PREFIX))("matches %s so the role gate runs", (prefix) => {
    expect(matches(`${prefix}/dashboard`)).toBe(true);
  });

  it("excludes build assets, which need no session and would waste an edge invocation", () => {
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  it("MATCHES /auth/* on purpose — the session refresh must run there too", () => {
    // Excluding it, as the brief proposed, would let refresh tokens expire
    // while a user sits on a public page. It is allowed through inside the
    // handler instead; see the pass-through tests below.
    expect(matches("/auth/login")).toBe(true);
  });

  it("MATCHES /api/* — API routes are guarded by requireApiRole, not by the proxy", () => {
    expect(matches("/api/projects/create")).toBe(true);
  });

  it("runs the session refresh on every matched request", async () => {
    await proxy(request("/auth/login"));
    await proxy(request("/homeowner/dashboard"));

    expect(updateSession).toHaveBeenCalledTimes(2);
  });
});

describe("public prefixes pass through without auth", () => {
  it.each(["/auth/login", "/auth/register", "/auth/callback", "/api/webhooks/stripe"])(
    "lets an unauthenticated request to %s through",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(redirectTarget(response)).toBeNull();
    },
  );

  it("does not redirect-loop on /auth/login for an unauthenticated user", async () => {
    // The failure mode this guards: /auth/login redirects to /auth/login.
    const response = await proxy(request("/auth/login"));

    expect(response.status).toBe(200);
    expect(redirectTarget(response)).toBeNull();
  });

  it("does not redirect-loop for a signed-in user with no role on /auth/login", async () => {
    session(signedIn(null));

    const response = await proxy(request("/auth/login"));

    expect(redirectTarget(response)).toBeNull();
  });

  it("leaves an unmatched public page alone", async () => {
    const response = await proxy(request("/"));

    expect(redirectTarget(response)).toBeNull();
  });

  it("GUARD: /invite/* is not public yet — add it to PUBLIC_PREFIXES when F13 ships", async () => {
    const response = await proxy(request("/invite/abc123"));

    // Today /invite is simply unmatched by any role prefix, so it falls through
    // untouched. The moment it becomes a real route this test will need
    // revisiting: an invited user is by definition not signed in.
    expect(redirectTarget(response)).toBeNull();
  });
});

describe("unauthenticated access to protected routes", () => {
  it.each(Object.values(ROLE_ROUTE_PREFIX))(
    "sends an unauthenticated request to %s to the login page",
    async (prefix) => {
      const response = await proxy(request(`${prefix}/dashboard`));

      expect(response.status).toBe(307);
      expect(redirectTarget(response)).toBe("/auth/login");
    },
  );

  it("preserves the intended path so login can resume it", async () => {
    const response = await proxy(request("/homeowner/project/abc"));

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/homeowner/project/abc");
  });

  it("gates /dashboard and /account on authentication without requiring a role", async () => {
    for (const pathname of ["/dashboard", "/account"]) {
      const response = await proxy(request(pathname));
      expect(redirectTarget(response)).toBe("/auth/login");
    }
  });

  it("bounces a signed-in user whose JWT carries no usable role", async () => {
    session(signedIn(null));

    const response = await proxy(request("/homeowner/dashboard"));

    expect(redirectTarget(response)).toBe("/auth/login");
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe(
      "missing_role",
    );
  });

  it("bounces a signed-in user whose role claim is not a known role", async () => {
    session(signedIn("superuser"));

    const response = await proxy(request("/homeowner/dashboard"));

    expect(redirectTarget(response)).toBe("/auth/login");
  });
});

describe("role routing", () => {
  it("redirects a contractor away from /homeowner to their own dashboard", async () => {
    session(signedIn("contractor"));

    const response = await proxy(request("/homeowner/dashboard"));

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("/contractor/dashboard");
  });

  it("lets each role into its own prefix", async () => {
    for (const [role, prefix] of Object.entries(ROLE_ROUTE_PREFIX)) {
      session(signedIn(role));

      const response = await proxy(request(`${prefix}/dashboard`));
      expect(redirectTarget(response)).toBeNull();
    }
  });

  it("keeps every role out of every other role's prefix", async () => {
    const entries = Object.entries(ROLE_ROUTE_PREFIX) as Array<[Role, string]>;

    for (const [role] of entries) {
      if (role === "admin") continue; // admins are allowed everywhere, asserted below

      for (const [otherRole, otherPrefix] of entries) {
        if (otherRole === role) continue;

        session(signedIn(role));
        const response = await proxy(request(`${otherPrefix}/dashboard`));

        expect(redirectTarget(response)).toBe(`${ROLE_ROUTE_PREFIX[role]}/dashboard`);
      }
    }
  });

  it("lets an admin into every role prefix (full platform access)", async () => {
    for (const prefix of Object.values(ROLE_ROUTE_PREFIX)) {
      session(signedIn("admin"));

      const response = await proxy(request(`${prefix}/dashboard`));
      expect(redirectTarget(response)).toBeNull();
    }
  });

  it("gates nested paths, not just the prefix root", async () => {
    session(signedIn("contractor"));

    const response = await proxy(request("/homeowner/project/abc/scan/manual/step-2"));

    expect(redirectTarget(response)).toBe("/contractor/dashboard");
  });

  it("does not gate a path that merely starts with the same characters", async () => {
    session(signedIn("contractor"));

    // `/homeowners-info` is not under `/homeowner`, and a naive startsWith
    // would wrongly capture it.
    const response = await proxy(request("/homeowners-info"));

    expect(redirectTarget(response)).toBeNull();
  });

  it("lets any authenticated role into /dashboard and /account", async () => {
    for (const role of Object.keys(ROLE_ROUTE_PREFIX)) {
      session(signedIn(role));

      expect(redirectTarget(await proxy(request("/dashboard")))).toBeNull();
      expect(redirectTarget(await proxy(request("/account")))).toBeNull();
    }
  });
});

describe("the proxy is optimistic, not a boundary", () => {
  it("trusts user_metadata.role, which the user can rewrite via auth.updateUser()", async () => {
    // A contractor who sets their own metadata role to "homeowner" gets PAST
    // the proxy. This test documents that rather than pretending otherwise.
    session(signedIn("homeowner"));

    const response = await proxy(request("/homeowner/dashboard"));
    expect(redirectTarget(response)).toBeNull();

    // What stops them is the next layer: requireApiRole() reads the
    // authoritative role from public.users, and RLS reads it in Postgres.
    // Asserted in ../security/rls.test.ts ("reads the role from public.users,
    // never from user_metadata").
  });
});

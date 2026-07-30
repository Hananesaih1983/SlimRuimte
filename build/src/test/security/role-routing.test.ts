// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  activeSession,
  createMockSupabase,
  resetDatabase,
  signIn,
  testUuid,
  type MockDatabase,
} from "../helpers/supabase-mock";
import { ROLES, ROLE_ROUTE_PREFIX, type Role } from "@/lib/roles";

/**
 * ROLE ROUTING END TO END — AND THE REDIRECT LOOP IT USED TO PRODUCE
 * =================================================================
 *
 * The role lives in two places and each layer routes on a different one:
 *
 *   - the proxy      -> `user_metadata.role` (the JWT claim; no DB round-trip)
 *   - the page/gate  -> `public.users.role`  (authoritative, RLS-enforced)
 *
 * That split is intentional and documented in `src/lib/roles.ts`. What was not
 * intentional is what happens when the two DISAGREE — after an admin changes a
 * role in the database, or after a user rewrites their own claim through
 * `auth.updateUser()`, which `middleware.test.ts` shows the proxy openly trusts.
 *
 * With claim=homeowner and database=contractor the two layers redirect at each
 * other forever:
 *
 *   /homeowner/dashboard  -> proxy allows (claim)  -> gate sends to /contractor
 *   /contractor/dashboard -> proxy sends to /homeowner (claim) -> gate sends to
 *   /contractor/dashboard -> ... until the browser gives up with ERR_TOO_MANY_REDIRECTS
 *
 * The user cannot reach ANY page, including the one that would let them log out.
 * `follow()` below simulates the two layers taking turns and fails if a path is
 * ever visited twice, so this cannot regress silently.
 */

class Redirected extends Error {
  constructor(readonly target: string) {
    super(`redirect(${target})`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Redirected(target);
  },
  notFound: () => {
    throw new Error("notFound()");
  },
}));

const updateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (request: NextRequest) => updateSession(request),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(activeSession.db, activeSession.user),
}));

const { requireRole, authoritativeRole } = await import("@/lib/auth");
const { proxy } = await import("@/proxy");
const { default: DashboardPage } = await import("@/app/dashboard/page");

const USER_ID = testUuid(1);

let db: MockDatabase;

/**
 * Signs a user in with a claim role and a database role, which may differ.
 * That divergence is the whole subject of this file.
 */
function session({ claim, database }: { claim: Role | null; database: Role | null }) {
  signIn({
    id: USER_ID,
    email: "test@example.nl",
    user_metadata: claim === null ? {} : { role: claim },
  });

  db.tables.set("users", []);
  if (database !== null) {
    db.seed("users", [{ id: USER_ID, role: database, deleted_at: null }]);
  }

  updateSession.mockImplementation((request: NextRequest) => ({
    response: NextResponse.next({ request }),
    user: activeSession.user as unknown as User,
  }));
}

function signedOut() {
  signIn(null);
  updateSession.mockImplementation((request: NextRequest) => ({
    response: NextResponse.next({ request }),
    user: null,
  }));
}

/** Runs a redirect-throwing server function and reports where it sent the user. */
async function redirectFrom(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof Redirected) return error.target;
    throw error;
  }
}

const REQUIRED_ROLE = Object.entries(ROLE_ROUTE_PREFIX).map(
  ([role, prefix]) => [prefix, role as Role] as const,
);

/** What the server layer does for a path once the proxy has let it through. */
async function serverDecision(pathname: string): Promise<string | null> {
  if (pathname === "/dashboard") {
    return redirectFrom(() => DashboardPage());
  }

  const entry = REQUIRED_ROLE.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!entry) return null; // public page, renders

  return redirectFrom(() => requireRole(entry[1]));
}

function proxyTarget(response: NextResponse): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

/**
 * Walks the proxy and the server gate alternately, the way a browser does, and
 * reports where the user comes to rest — or throws if they never do.
 */
async function follow(startPath: string, maxHops = 12) {
  const visited: string[] = [];
  let path = startPath;

  for (let hop = 0; hop < maxHops; hop += 1) {
    if (visited.includes(path)) {
      throw new Error(
        `Redirect loop: ${[...visited, path].join(" -> ")}`,
      );
    }
    visited.push(path);

    const fromProxy = proxyTarget(await proxy(new NextRequest(`http://localhost${path}`)));
    if (fromProxy) {
      path = fromProxy;
      continue;
    }

    const fromServer = await serverDecision(path.split("?")[0]);
    if (fromServer) {
      path = fromServer;
      continue;
    }

    return { settled: path, hops: visited.length, visited };
  }

  throw new Error(`Did not settle within ${maxHops} hops: ${visited.join(" -> ")}`);
}

beforeEach(() => {
  db = resetDatabase();
  updateSession.mockReset();
  signedOut();
});

describe("the /dashboard role dispatcher", () => {
  it.each(Object.entries(ROLE_ROUTE_PREFIX))(
    "sends %s to their own dashboard",
    async (role, prefix) => {
      session({ claim: role as Role, database: role as Role });

      expect(await redirectFrom(() => DashboardPage())).toBe(`${prefix}/dashboard`);
    },
  );

  it("sends a visitor with no session to the login page", async () => {
    signedOut();

    expect(await redirectFrom(() => DashboardPage())).toBe("/auth/login");
  });

  it("reads the role from public.users, not from the JWT claim", async () => {
    // The claim says admin; the database says homeowner. Dispatching on the
    // claim would hand out the admin dashboard to a homeowner.
    session({ claim: "admin", database: "homeowner" });

    expect(await redirectFrom(() => DashboardPage())).not.toBe("/admin/dashboard");
  });

  it("bounces a user with a session but no row in public.users", async () => {
    session({ claim: "homeowner", database: null });

    expect(await redirectFrom(() => DashboardPage())).toBe(
      "/auth/login?error=missing_role",
    );
  });

  it("treats a soft-deleted user as having no role", async () => {
    signIn({ id: USER_ID, email: "test@example.nl", user_metadata: { role: "homeowner" } });
    db.seed("users", [{ id: USER_ID, role: "homeowner", deleted_at: "2026-07-01T00:00:00Z" }]);

    expect(await redirectFrom(() => DashboardPage())).toBe(
      "/auth/login?error=missing_role",
    );
  });

  it("never dispatches to itself", async () => {
    for (const role of ROLES) {
      session({ claim: role, database: role });

      expect(await redirectFrom(() => DashboardPage())).not.toBe("/dashboard");
    }
  });
});

describe("requireRole", () => {
  it("lets a role into its own area", async () => {
    session({ claim: "homeowner", database: "homeowner" });

    const { role, user } = await requireRole("homeowner");

    expect(role).toBe("homeowner");
    expect(user.id).toBe(USER_ID);
  });

  it("redirects a contractor out of the homeowner area", async () => {
    session({ claim: "contractor", database: "contractor" });

    expect(await redirectFrom(() => requireRole("homeowner"))).toBe(
      "/contractor/dashboard",
    );
  });

  it("lets an admin into every role area", async () => {
    session({ claim: "admin", database: "admin" });

    for (const role of ROLES) {
      await expect(requireRole(role)).resolves.toMatchObject({ role: "admin" });
    }
  });

  it("gates on the database role even when the claim was tampered with", async () => {
    // The escalation the proxy cannot stop: rewrite your own claim to admin.
    session({ claim: "admin", database: "homeowner" });

    const target = await redirectFrom(() => requireRole("admin"));

    expect(target).not.toBeNull();
    expect(target).not.toBe("/admin/dashboard");
  });
});

describe("the two role stores disagreeing", () => {
  it("sends the user back through auth instead of at another dashboard", async () => {
    session({ claim: "homeowner", database: "contractor" });

    const target = await redirectFrom(() => requireRole("homeowner"));

    // A role dashboard here is what caused the loop: the proxy immediately
    // bounces it back on the strength of the claim.
    expect(target).toBe("/auth/login?error=role_mismatch");
  });

  it("does the same from the dispatcher", async () => {
    session({ claim: "homeowner", database: "contractor" });

    expect(await redirectFrom(() => DashboardPage())).toBe(
      "/auth/login?error=role_mismatch",
    );
  });

  it("picks a destination the proxy will not bounce", async () => {
    session({ claim: "homeowner", database: "contractor" });

    const target = (await redirectFrom(() => requireRole("homeowner")))!;
    const response = await proxy(new NextRequest(`http://localhost${target}`));

    // /auth/* is in the proxy's PUBLIC_PREFIXES — the one exit neither layer
    // will redirect away from.
    expect(proxyTarget(response)).toBeNull();
  });

  it("reports the divergence rather than silently trusting either store", async () => {
    session({ claim: "estate_agent", database: "interior_designer" });

    expect(await redirectFrom(() => authoritativeRole(activeSession.user as never))).toBe(
      "/auth/login?error=role_mismatch",
    );
  });
});

describe("no infinite redirect loop", () => {
  it.each(Object.entries(ROLE_ROUTE_PREFIX))(
    "settles %s on their own dashboard",
    async (role, prefix) => {
      session({ claim: role as Role, database: role as Role });

      const { settled } = await follow(`${prefix}/dashboard`);

      expect(settled).toBe(`${prefix}/dashboard`);
    },
  );

  it("settles a signed-out visitor on the login page", async () => {
    signedOut();

    const { settled } = await follow("/homeowner/dashboard");

    // `searchParams.set` percent-encodes the resumed path.
    expect(settled).toBe("/auth/login?redirect=%2Fhomeowner%2Fdashboard");
  });

  it("settles /dashboard for every role", async () => {
    for (const [role, prefix] of Object.entries(ROLE_ROUTE_PREFIX)) {
      session({ claim: role as Role, database: role as Role });

      const { settled } = await follow("/dashboard");

      expect(settled).toBe(`${prefix}/dashboard`);
    }
  });

  it("settles a role that wandered into another role's area", async () => {
    session({ claim: "contractor", database: "contractor" });

    const { settled } = await follow("/homeowner/dashboard");

    expect(settled).toBe("/contractor/dashboard");
  });

  /**
   * THE REGRESSION TEST. Before the fix in `authoritativeRole`, every one of
   * these threw "Redirect loop: /homeowner/dashboard -> /contractor/dashboard
   * -> /homeowner/dashboard".
   */
  it.each([
    ["claim homeowner, database contractor", "homeowner", "contractor"],
    ["claim contractor, database homeowner", "contractor", "homeowner"],
    ["claim estate_agent, database interior_designer", "estate_agent", "interior_designer"],
    ["claim homeowner, database admin", "homeowner", "admin"],
  ] as const)("settles when the stores disagree (%s)", async (_label, claim, database) => {
    session({ claim, database });

    const { settled } = await follow(`${ROLE_ROUTE_PREFIX[claim]}/dashboard`);

    expect(settled).toBe("/auth/login?error=role_mismatch");
  });

  it("settles from /dashboard when the stores disagree", async () => {
    session({ claim: "homeowner", database: "contractor" });

    const { settled } = await follow("/dashboard");

    expect(settled).toBe("/auth/login?error=role_mismatch");
  });

  it("settles for every divergent pair of roles", async () => {
    for (const claim of ROLES) {
      for (const database of ROLES) {
        if (claim === database) continue;

        session({ claim, database });

        const { settled } = await follow(`${ROLE_ROUTE_PREFIX[claim]}/dashboard`);
        expect(settled).toBe("/auth/login?error=role_mismatch");
      }
    }
  });

  it("settles the homepage, which is gated by neither layer", async () => {
    session({ claim: "homeowner", database: "homeowner" });

    const { settled, hops } = await follow("/");

    expect(settled).toBe("/");
    expect(hops).toBe(1);
  });
});

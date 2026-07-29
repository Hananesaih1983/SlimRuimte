import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  PREFIX_REQUIRED_ROLE,
  dashboardPathForRole,
  roleFromUserMetadata,
} from "@/lib/roles";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`
 * (see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * It lives in `src/` so it sits alongside `src/app`.
 *
 * Two jobs, in order:
 *  1. Refresh the Supabase session on EVERY matched request. This is why the
 *     matcher is a negative lookahead rather than a protected-routes allowlist —
 *     skipping it on public pages lets refresh tokens expire.
 *  2. Enforce role routing before the route renders.
 *
 * This is an optimistic check only. RLS in Postgres is the real boundary, and
 * each role layout re-checks server-side (see `src/app/(homeowner)/layout.tsx`).
 */

/** Any authenticated user may enter these; no role requirement. */
const AUTHENTICATED_ONLY_PREFIXES = ["/dashboard", "/account"];

const PUBLIC_PREFIXES = ["/auth", "/api/webhooks"];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    return response;
  }

  const requiredRoleEntry = PREFIX_REQUIRED_ROLE.find(([prefix]) =>
    isUnder(pathname, prefix),
  );
  const needsAuth =
    requiredRoleEntry !== undefined ||
    AUTHENTICATED_ONLY_PREFIXES.some((prefix) => isUnder(pathname, prefix));

  if (!needsAuth) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = roleFromUserMetadata(user.user_metadata);

  // Signed in but no usable role claim — send them back through auth rather
  // than leaking a role-scoped page.
  if (!role) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("error", "missing_role");
    return NextResponse.redirect(loginUrl);
  }

  if (requiredRoleEntry) {
    const [, requiredRole] = requiredRoleEntry;
    // Admins have full read/write across the platform (permission matrix).
    if (role !== requiredRole && role !== "admin") {
      return NextResponse.redirect(
        new URL(dashboardPathForRole(role), request.url),
      );
    }
  }

  return response;
}

export const config = {
  // Match everything except static assets, so the session refresh always runs.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

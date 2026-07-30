import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  type Role,
  dashboardPathForRole,
  isRole,
  roleFromUserMetadata,
} from "@/lib/roles";

/** Returns the authenticated user, or null. Never throws. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

/**
 * Reads the authoritative role from `public.users`.
 *
 * NOT `user_metadata.role`: Supabase lets a user rewrite their own metadata via
 * `auth.updateUser()`, so the JWT claim is advisory only. The proxy uses it for
 * a cheap optimistic redirect; this is the check that actually gates the page.
 */
export async function getUserRole(userId: string): Promise<Role | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  return isRole(data?.role) ? data.role : null;
}

/**
 * The authoritative role, plus a guard against the two role stores disagreeing.
 *
 * INFINITE REDIRECT LOOP THIS PREVENTS
 * ------------------------------------
 * The role lives in two places (see `src/lib/roles.ts`) and each layer routes
 * on a different one: the proxy on `user_metadata.role` (edge-cheap, no DB
 * round-trip), this gate on `public.users.role` (authoritative, RLS-enforced).
 * They are written together at registration, but they drift — an admin changing
 * a role in the database, or a user rewriting their own claim through
 * `auth.updateUser()`, which the proxy openly trusts.
 *
 * Once they disagree the two layers bounce the request between them forever.
 * With claim=homeowner and database=contractor:
 *
 *   GET /homeowner/dashboard  -> proxy allows (claim says homeowner)
 *                             -> this gate redirects to /contractor/dashboard
 *   GET /contractor/dashboard -> proxy redirects to /homeowner/dashboard
 *                             -> ...forever, until the browser gives up
 *
 * Redirecting to any role dashboard is therefore unsafe while the two disagree.
 * `/auth/*` is in the proxy's PUBLIC_PREFIXES, so it is the one destination
 * neither layer will bounce, and re-authenticating re-mints the claim.
 */
export async function authoritativeRole(user: User): Promise<Role> {
  const role = await getUserRole(user.id);

  if (!role) {
    redirect("/auth/login?error=missing_role");
  }

  if (roleFromUserMetadata(user.user_metadata) !== role) {
    redirect("/auth/login?error=role_mismatch");
  }

  return role;
}

/**
 * Server-side role gate for the role route groups.
 *
 * The proxy already redirects on role mismatch, but Server Functions and direct
 * RSC requests can bypass a proxy matcher, so every role layout re-checks here.
 * RLS remains the authoritative boundary.
 */
export async function requireRole(
  required: Role,
): Promise<{ user: User; role: Role }> {
  const user = await requireUser();
  const role = await authoritativeRole(user);

  // Admins have full read/write across the platform (permission matrix).
  // Safe to send them to their own dashboard: `authoritativeRole` has already
  // established that the proxy's claim agrees, so it will not bounce back.
  if (role !== required && role !== "admin") {
    redirect(dashboardPathForRole(role));
  }

  return { user, role };
}

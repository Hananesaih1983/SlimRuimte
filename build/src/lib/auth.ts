import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { type Role, dashboardPathForRole, isRole } from "@/lib/roles";

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
  const role = await getUserRole(user.id);

  if (!role) {
    redirect("/auth/login?error=missing_role");
  }

  // Admins have full read/write across the platform (permission matrix).
  if (role !== required && role !== "admin") {
    redirect(dashboardPathForRole(role));
  }

  return { user, role };
}

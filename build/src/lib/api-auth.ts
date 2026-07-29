import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { type Role, isRole } from "@/lib/roles";

export { isUuid } from "@/lib/uuid";

/**
 * Auth guards for Route Handlers.
 *
 * `requireRole()` in `src/lib/auth.ts` calls `redirect()`, which is right for a
 * page but wrong for a JSON endpoint — a `fetch()` would silently follow the
 * 307 to the login HTML and the caller would try to `JSON.parse` a document.
 * These return a JSON error Response instead, so the client always gets JSON.
 *
 * Note the proxy does not gate `/api/*` (only the role prefixes and
 * `/dashboard`), so these checks are not redundant — they are the only
 * application-layer guard on these routes. RLS remains the real boundary.
 */

export type AuthedContext = {
  user: User;
  role: Role;
  supabase: SupabaseClient;
};

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: message, ...extra }, { status });
}

/**
 * Resolves the caller, or returns a Response to send back untouched.
 *
 * Callers discriminate on the `error` key:
 *   const auth = await requireApiRole("homeowner");
 *   if (auth.error) return auth.error;
 */
export async function requireApiRole(
  required: Role,
): Promise<{ error: Response; ctx?: never } | { error?: never; ctx: AuthedContext }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: jsonError("Niet ingelogd.", 401) };
  }

  // Authoritative role from public.users — never user_metadata, which the user
  // can rewrite via auth.updateUser().
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const role = isRole(data?.role) ? data.role : null;

  if (!role) {
    return { error: jsonError("Geen geldige rol gevonden voor dit account.", 403) };
  }

  // Admins have full read/write across the platform (permission matrix).
  if (role !== required && role !== "admin") {
    return { error: jsonError("Geen toegang tot deze actie.", 403) };
  }

  return { ctx: { user, role, supabase } };
}

/** Parses a JSON body, returning `null` when it is absent or malformed. */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}


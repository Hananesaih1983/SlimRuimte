/**
 * Single source of truth for the 5 roles defined in
 * `../venture/06_architecture.md` (ROLE & PERMISSION MODEL).
 *
 * One user = exactly one role, set at registration and stored in two places:
 *  - `auth.users.raw_user_meta_data.role` — readable from the JWT, used by the
 *    proxy for edge-cheap routing decisions.
 *  - `public.users.role` — the authoritative value, enforced by RLS.
 */
export const ROLES = [
  "homeowner",
  "contractor",
  "interior_designer",
  "estate_agent",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles a user can pick during self-service registration (admin is granted manually). */
export const REGISTERABLE_ROLES = [
  "homeowner",
  "contractor",
  "interior_designer",
  "estate_agent",
] as const satisfies readonly Role[];

export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

/** URL prefix owned by each role. Keep in sync with the route groups in `src/app`. */
export const ROLE_ROUTE_PREFIX = {
  homeowner: "/homeowner",
  contractor: "/contractor",
  interior_designer: "/designer",
  estate_agent: "/agent",
  admin: "/admin",
} as const satisfies Record<Role, string>;

/** Reverse map: URL prefix -> role required to enter it. */
export const PREFIX_REQUIRED_ROLE: ReadonlyArray<readonly [string, Role]> =
  Object.entries(ROLE_ROUTE_PREFIX).map(([role, prefix]) => [
    prefix,
    role as Role,
  ]);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isRegisterableRole(value: unknown): value is RegisterableRole {
  return (
    typeof value === "string" &&
    (REGISTERABLE_ROLES as readonly string[]).includes(value)
  );
}

/** Landing page for a role after login. */
export function dashboardPathForRole(role: Role): string {
  return `${ROLE_ROUTE_PREFIX[role]}/dashboard`;
}

/** Reads the role from Supabase user metadata, returning null when unset/invalid. */
export function roleFromUserMetadata(
  metadata: Record<string, unknown> | undefined | null,
): Role | null {
  const role = metadata?.role;
  return isRole(role) ? role : null;
}

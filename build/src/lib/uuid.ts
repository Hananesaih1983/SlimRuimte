/**
 * Kept in its own module so client components can import it.
 *
 * The obvious home would be `src/lib/api-auth.ts`, but that pulls in
 * `src/lib/supabase/server.ts` -> `next/headers`, which is server-only and
 * fails the build the moment a `"use client"` file touches it.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loose UUID check, so junk is rejected before Postgres returns a 22P02. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

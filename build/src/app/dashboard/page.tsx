import { redirect } from "next/navigation";
import { authoritativeRole, requireUser } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/roles";

/**
 * Role dispatcher. The auth callback and login always land here; this bounces
 * the user to the dashboard for their role so callers never need to know it.
 *
 * `authoritativeRole` reads `public.users.role` — never the JWT claim — and
 * refuses to dispatch at all when the two disagree, which would otherwise
 * ping-pong against the proxy forever. See its docstring.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const role = await authoritativeRole(user);

  redirect(dashboardPathForRole(role));
}

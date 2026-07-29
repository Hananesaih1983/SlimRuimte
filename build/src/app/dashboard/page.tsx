import { redirect } from "next/navigation";
import { getUserRole, requireUser } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/roles";

/**
 * Role dispatcher. The auth callback and login always land here; this bounces
 * the user to the dashboard for their role so callers never need to know it.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const role = await getUserRole(user.id);

  if (!role) {
    redirect("/auth/login?error=missing_role");
  }

  redirect(dashboardPathForRole(role));
}

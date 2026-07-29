import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function HomeownerDashboardPage() {
  const { user } = await requireRole("homeowner");
  return <RoleDashboard role="homeowner" email={user.email} />;
}

import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function DesignerDashboardPage() {
  const { user } = await requireRole("interior_designer");
  return <RoleDashboard role="interior_designer" email={user.email} />;
}

import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const { user } = await requireRole("admin");
  return <RoleDashboard role="admin" email={user.email} />;
}

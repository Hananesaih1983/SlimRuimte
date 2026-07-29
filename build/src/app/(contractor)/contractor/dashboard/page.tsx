import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function ContractorDashboardPage() {
  const { user } = await requireRole("contractor");
  return <RoleDashboard role="contractor" email={user.email} />;
}

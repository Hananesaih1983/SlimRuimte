import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function AgentDashboardPage() {
  const { user } = await requireRole("estate_agent");
  return <RoleDashboard role="estate_agent" email={user.email} />;
}

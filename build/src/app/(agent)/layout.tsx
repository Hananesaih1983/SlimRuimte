import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/agent/*` require role=estate_agent (or admin). */
export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireRole("estate_agent");
  return (
    <RoleShell role="estate_agent" email={user.email}>
      {children}
    </RoleShell>
  );
}

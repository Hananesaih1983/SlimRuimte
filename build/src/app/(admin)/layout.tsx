import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/admin/*` require role=admin. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireRole("admin");
  return (
    <RoleShell role="admin" email={user.email}>
      {children}
    </RoleShell>
  );
}

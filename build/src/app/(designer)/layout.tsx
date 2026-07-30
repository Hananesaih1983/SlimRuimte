import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/designer/*` require role=interior_designer (or admin). */
export default async function DesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireRole("interior_designer");
  return (
    <RoleShell role="interior_designer" email={user.email}>
      {children}
    </RoleShell>
  );
}

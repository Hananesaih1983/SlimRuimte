import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/homeowner/*` require role=homeowner (or admin). */
export default async function HomeownerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireRole("homeowner");
  return (
    <RoleShell role="homeowner" email={user.email}>
      {children}
    </RoleShell>
  );
}

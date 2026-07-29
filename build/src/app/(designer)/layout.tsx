import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/designer/*` require role=interior_designer (or admin). */
export default async function DesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("interior_designer");
  return <RoleShell role="interior_designer">{children}</RoleShell>;
}

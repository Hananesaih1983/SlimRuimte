import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/contractor/*` require role=contractor (or admin). */
export default async function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("contractor");
  return <RoleShell role="contractor">{children}</RoleShell>;
}

import { RoleShell } from "@/components/role-shell";
import { requireRole } from "@/lib/auth";

/** All routes under `/homeowner/*` require role=homeowner (or admin). */
export default async function HomeownerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("homeowner");
  return <RoleShell role="homeowner">{children}</RoleShell>;
}

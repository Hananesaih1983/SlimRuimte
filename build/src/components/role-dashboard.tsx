import { getTranslations } from "next-intl/server";
import type { Role } from "@/lib/roles";

/** Placeholder dashboard body — Week 1 proves auth + role routing only. */
export async function RoleDashboard({
  role,
  email,
}: {
  role: Role;
  email: string | undefined;
}) {
  const [tCommon, tDashboard, tRoles] = await Promise.all([
    getTranslations("common"),
    getTranslations("dashboard"),
    getTranslations("roles"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{tCommon("welcome")}</h1>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">{tDashboard("yourRole")}</dt>
          <dd className="text-sm font-medium">{tRoles(`${role}.name`)}</dd>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">{tDashboard("signedInAs")}</dt>
          <dd className="text-sm font-medium">{email}</dd>
        </div>
      </dl>
    </div>
  );
}

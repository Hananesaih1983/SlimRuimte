import { getTranslations } from "next-intl/server";
import type { Role } from "@/lib/roles";

/**
 * Welcome header shared by every role dashboard.
 *
 * Role and email also appear in the NavBar, but repeating the email here is
 * deliberate: on a phone the NavBar hides it, and during user testing the
 * founder needs to see at a glance which account a screenshot came from.
 */
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
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        {tCommon("welcome")}
        {email ? `, ${email}` : ""}
      </h1>
      <p className="text-sm text-muted-foreground">
        {tDashboard("yourRole")}: {tRoles(`${role}.name`)}
      </p>
    </div>
  );
}

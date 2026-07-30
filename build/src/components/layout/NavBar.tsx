import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { ROLE_ROUTE_PREFIX, type Role } from "@/lib/roles";

/**
 * Signed-in navigation bar: brand on the left, identity and sign-out on the
 * right. Rendered once per request by `RoleShell`, so every role-scoped page
 * gets the same chrome and there is always a way back out of the app.
 *
 * The email is hidden below `sm` — it wraps badly on a phone and the role badge
 * already tells the user which account they are in.
 */
export async function NavBar({
  userEmail,
  role,
}: {
  userEmail: string | undefined;
  role: Role;
}) {
  const [tNav, tRoles] = await Promise.all([
    getTranslations("nav"),
    getTranslations("roles"),
  ]);

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href={`${ROLE_ROUTE_PREFIX[role]}/dashboard`}
          className="text-base font-semibold tracking-tight"
        >
          SlimRuimte
        </Link>
        <Link
          href={`${ROLE_ROUTE_PREFIX[role]}/dashboard`}
          className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
        >
          {tNav("dashboard")}
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {userEmail ? (
            <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:inline">
              {userEmail}
            </span>
          ) : null}
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tRoles(`${role}.name`)}
          </span>
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}

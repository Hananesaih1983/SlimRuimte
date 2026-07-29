import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { ROLE_ROUTE_PREFIX, type Role } from "@/lib/roles";

/**
 * Shared chrome for the five role route groups. Each role layout wraps its
 * children in this so navigation stays consistent while the role-specific
 * layouts keep their own access checks.
 */
export async function RoleShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [tNav, tRoles] = await Promise.all([
    getTranslations("nav"),
    getTranslations("roles"),
  ]);
  const prefix = ROLE_ROUTE_PREFIX[role];

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
          <Link href={`${prefix}/dashboard`} className="font-semibold">
            SlimRuimte
          </Link>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tRoles(`${role}.name`)}
          </span>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href={`${prefix}/dashboard`} className="hover:underline">
              {tNav("dashboard")}
            </Link>
            <Link href={`${prefix}/profiel`} className="hover:underline">
              {tNav("profile")}
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}

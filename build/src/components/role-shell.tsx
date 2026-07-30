import { NavBar } from "@/components/layout/NavBar";
import type { Role } from "@/lib/roles";

/**
 * Shared chrome for the five role route groups. Each role layout wraps its
 * children in this so navigation stays consistent while the role-specific
 * layouts keep their own access checks.
 */
export async function RoleShell({
  role,
  email,
  children,
}: {
  role: Role;
  email: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <NavBar userEmail={email} role={role} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

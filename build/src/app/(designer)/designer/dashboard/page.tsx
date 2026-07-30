import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function DesignerDashboardPage() {
  const { user } = await requireRole("interior_designer");
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-10">
      <RoleDashboard role="interior_designer" email={user.email} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("assignments")}</h2>
        {/* Designer matching is F09 (Week 8); pro-initiated projects are F13. */}
        <EmptyState
          icon="🎨"
          title={t("no_assignments")}
          body={t("no_assignments_body")}
        />
      </section>
    </div>
  );
}

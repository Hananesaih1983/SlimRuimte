import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function ContractorDashboardPage() {
  const { user } = await requireRole("contractor");
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-10">
      <RoleDashboard role="contractor" email={user.email} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("leads")}</h2>
        {/* Lead matching is F09 (Week 8). Until then this is honestly empty
            rather than seeded with fake leads. */}
        <EmptyState icon="🔨" title={t("no_leads")} body={t("no_leads_body")} />
      </section>
    </div>
  );
}

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
        <p className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
          💡 <strong>Pro-tip:</strong> Als interieurontwerper kun je ook zelf een project aanmaken voor een klant — deze functie komt in Week 9 beschikbaar. Tot die tijd ontvang je opdrachten via het platform zodra huiseigenaren een visualisatie aanvragen.
        </p>
      </section>
    </div>
  );
}

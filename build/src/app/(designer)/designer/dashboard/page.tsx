import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function DesignerDashboardPage() {
  const { user } = await requireRole("interior_designer");

  return (
    <div className="flex flex-col gap-10">
      <RoleDashboard role="interior_designer" email={user.email} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Opdrachten</h2>
        {/* Designer matching is F09 (Week 8); pro-initiated projects are F13. */}
        <EmptyState
          icon="🎨"
          title="Geen opdrachten beschikbaar"
          body="Zodra huiseigenaren een ontwerpvraag indienen, verschijnen hun projecten hier. Je betaalt €25 per lead die je accepteert."
        />
      </section>
    </div>
  );
}

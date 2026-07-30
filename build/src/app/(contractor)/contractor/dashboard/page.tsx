import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/auth";

export default async function ContractorDashboardPage() {
  const { user } = await requireRole("contractor");

  return (
    <div className="flex flex-col gap-10">
      <RoleDashboard role="contractor" email={user.email} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Leads</h2>
        {/* Lead matching is F09 (Week 8). Until then this is honestly empty
            rather than seeded with fake leads. */}
        <EmptyState
          icon="🔨"
          title="Geen leads beschikbaar"
          body="Zodra huiseigenaren in jouw regio een project afronden, verschijnen hun aanvragen hier. Je betaalt €35 per lead die je accepteert."
        />
      </section>
    </div>
  );
}

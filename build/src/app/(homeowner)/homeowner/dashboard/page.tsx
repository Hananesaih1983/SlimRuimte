import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS } from "@/lib/projects";
import { ROOM_TYPES } from "@/lib/scan/types";

type ProjectRow = {
  id: string;
  title: string | null;
  status: string;
  renovation_type: string | null;
  scan_method: string | null;
  created_at: string | null;
};

export default async function HomeownerDashboardPage() {
  const { user } = await requireRole("homeowner");
  const supabase = await createClient();

  // RLS (`project_owner`) already scopes this to the caller; the explicit
  // homeowner_id filter keeps the index on (homeowner_id, status, created_at).
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, status, renovation_type, scan_method, created_at")
    .eq("homeowner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = (projects ?? []) as ProjectRow[];

  return (
    <div className="flex flex-col gap-10">
      <RoleDashboard role="homeowner" email={user.email} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Mijn projecten</h2>
          {error || rows.length > 0 ? (
            <Link
              href="/homeowner/project/new"
              className={buttonVariants({ size: "lg" })}
            >
              Nieuw project starten
            </Link>
          ) : null}
        </div>

        {/* A failed query must never render as the empty state. "Nog geen
            projecten" to a homeowner who has three of them reads as data loss
            and invites them to scan the same room again. */}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            Je projecten konden niet worden geladen. Vernieuw de pagina — je
            projecten zijn niet verdwenen.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="📐"
            title="Nog geen projecten"
            body="Scan je ruimte in en krijg binnen enkele minuten een plattegrond en visualisaties van je verbouwing."
          >
            <Link
              href="/homeowner/project/new"
              className={buttonVariants({ size: "lg" })}
            >
              Nieuw project starten
            </Link>
          </EmptyState>
        ) : (
          <ProjectList projects={rows} />
        )}
      </section>
    </div>
  );
}

function ProjectList({ projects }: { projects: ProjectRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((project) => {
        const roomType = ROOM_TYPES.find(
          (candidate) => candidate.id === project.renovation_type,
        );

        return (
          <li key={project.id}>
            <Link
              href={`/homeowner/project/${project.id}`}
              className="flex h-full flex-col gap-3 rounded-xl border border-border px-4 py-4 transition-colors hover:bg-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-xl">
                    {roomType?.icon ?? "🏠"}
                  </span>
                  <span className="text-sm font-medium">
                    {project.title ?? roomType?.label ?? "Verbouwing"}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {formatDate(project.created_at)}
                {project.scan_method
                  ? ` · ${project.scan_method === "lidar" ? "LiDAR" : "Handmatig gemeten"}`
                  : ""}
              </p>

              <span className="mt-auto text-sm font-medium text-primary">
                Bekijk project →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

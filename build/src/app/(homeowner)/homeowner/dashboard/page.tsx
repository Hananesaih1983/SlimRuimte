import Link from "next/link";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { RoleDashboard } from "@/components/role-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROOM_TYPES } from "@/lib/scan/types";
import { FORMAT_LOCALE, isLocale } from "@/i18n/config";

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
  const [t, locale] = await Promise.all([getTranslations("dashboard"), getLocale()]);

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
          <h2 className="text-lg font-semibold">{t("my_projects")}</h2>
          {error || rows.length > 0 ? (
            <Link
              href="/homeowner/project/new"
              className={buttonVariants({ size: "lg" })}
            >
              {t("new_project")}
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
            {t("projects_error")}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon="📐" title={t("no_projects")} body={t("no_projects_body")}>
            <Link
              href="/homeowner/project/new"
              className={buttonVariants({ size: "lg" })}
            >
              {t("new_project")}
            </Link>
          </EmptyState>
        ) : (
          <ProjectList projects={rows} locale={locale} />
        )}
      </section>
    </div>
  );
}

function ProjectList({
  projects,
  locale,
}: {
  projects: ProjectRow[];
  locale: string;
}) {
  const t = useTranslations("dashboard");
  // The room name and the status badge are the only two card fields whose copy
  // comes from the database rather than a message key. Both were rendering the
  // hardcoded Dutch from `ROOM_TYPES` / `PROJECT_STATUS_LABELS`, so a card still
  // read "Keuken · Plattegrond klaar" after switching to EN or FR.
  const tRooms = useTranslations("room_types");
  const tStatus = useTranslations("project_status");

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((project) => {
        const roomType = ROOM_TYPES.find(
          (candidate) => candidate.id === project.renovation_type,
        );
        // A status outside the CHECK constraint has no message key; show the raw
        // value rather than next-intl's "project_status.foo" error string.
        const status = tStatus.has(project.status)
          ? tStatus(project.status)
          : project.status;

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
                    {project.title ??
                      (roomType ? tRooms(roomType.id) : t("untitled_project"))}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {status}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {formatDate(project.created_at, locale)}
                {project.scan_method
                  ? ` · ${project.scan_method === "lidar" ? "LiDAR" : t("measured_manually")}`
                  : ""}
              </p>

              <span className="mt-auto text-sm font-medium text-primary">
                {t("view_project")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    isLocale(locale) ? FORMAT_LOCALE[locale] : FORMAT_LOCALE.nl,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    },
  ).format(new Date(value));
}

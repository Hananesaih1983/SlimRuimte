import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_PLAN_READY } from "@/lib/projects";
import { parseWall } from "@/lib/scan/geometry";
import { ROOM_TYPES, type RoomDimensions, type Wall } from "@/lib/scan/types";
import { isUuid } from "@/lib/uuid";

/**
 * Project detail — the landing spot after a scan and the hub for next steps.
 *
 * Ownership is enforced three deep: the homeowner layout gates the role, RLS
 * scopes the row, and the explicit `homeowner_id` filter below turns someone
 * else's project id into a 404 rather than an empty page.
 */
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireRole("homeowner");

  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, title, status, renovation_type, postcode, country, scan_method, scan_source, magicplan_project_id, room_dimensions, created_at",
    )
    .eq("id", id)
    .eq("homeowner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) notFound();

  const scan = parseRoomDimensions(project.room_dimensions);
  const roomType = ROOM_TYPES.find(
    (candidate) => candidate.id === project.renovation_type,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {project.title ?? roomType?.label ?? "Mijn project"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              PROJECT_STATUS_LABELS[project.status] ?? project.status,
              project.postcode,
              project.country,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link
          href="/homeowner/dashboard"
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Terug naar dashboard
        </Link>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact
          label="Status"
          value={PROJECT_STATUS_LABELS[project.status] ?? project.status}
        />
        <Fact label="Scanmethode" value={describeScanMethod(project.scan_method)} />
        <Fact
          label="Bron"
          value={describeScanSource(project.scan_source, project.magicplan_project_id)}
        />
      </dl>

      {scan ? <ScanSection scan={scan} /> : <NoScanYet projectId={project.id} />}

      <NextSteps status={project.status} hasScan={scan !== null} />
    </div>
  );
}

function ScanSection({ scan }: { scan: RoomDimensions }) {
  const { dimensions, walls, accuracy } = scan;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Afmetingen</h2>

      {scan.source === "mock" ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Testdata — geïmporteerd zonder magicplan-API-sleutel.
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,340px)_1fr]">
        <RoomDiagramSVG
          walls={walls}
          className="w-full rounded-xl border border-border"
        />

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Breedte" value={`${dimensions.width.toFixed(2)} m`} />
            <Fact label="Diepte" value={`${dimensions.depth.toFixed(2)} m`} />
            <Fact label="Hoogte" value={`${dimensions.height.toFixed(2)} m`} />
            <Fact label="Oppervlakte" value={`${dimensions.area.toFixed(2)} m²`} />
            <Fact label="Omtrek" value={`${dimensions.perimeter.toFixed(2)} m`} />
            <Fact label="Nauwkeurigheid" value={accuracy} />
          </dl>

          <ul className="flex flex-col gap-2">
            {walls.map((wall) => (
              <li
                key={wall.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm font-medium">{wall.label}</span>
                <span className="text-sm text-muted-foreground">
                  {wall.length.toFixed(2)} m × {wall.height.toFixed(2)} m ·{" "}
                  {wall.doors.length} deur(en), {wall.windows.length} raam/ramen
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function NoScanYet({ projectId }: { projectId: string }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-border px-6 py-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Nog geen afmetingen</h2>
        <p className="text-sm text-muted-foreground">
          Meet de ruimte in om je plattegrond te laten genereren.
        </p>
      </div>
      <Link
        href={`/homeowner/project/new?projectId=${projectId}`}
        className={buttonVariants({ size: "lg" })}
      >
        Ruimte scannen →
      </Link>
    </section>
  );
}

/** Week 3+ stages are not built yet, so they are listed but not linked. */
function NextSteps({ status, hasScan }: { status: string; hasScan: boolean }) {
  const planReady = hasScan && status === PROJECT_STATUS_PLAN_READY;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Volgende stappen</h2>
      <ul className="flex flex-col gap-2">
        <Step done={hasScan} label="Ruimte opmeten" />
        <Step done={planReady} label="Plattegrond genereren" />
        <Step done={false} label="Stijl kiezen en visualisaties maken" upcoming />
        <Step done={false} label="Briefing naar ontwerper of aannemer" upcoming />
      </ul>
    </section>
  );
}

function Step({
  done,
  label,
  upcoming,
}: {
  done: boolean;
  label: string;
  upcoming?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden className={done ? "text-emerald-600" : "text-muted-foreground"}>
        {done ? "✓" : "○"}
      </span>
      <span className={upcoming ? "text-muted-foreground" : undefined}>{label}</span>
      {upcoming ? (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Binnenkort
        </span>
      ) : null}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function describeScanMethod(method: string | null): string {
  if (method === "lidar") return "LiDAR (magicplan)";
  if (method === "manual") return "Handmatig gemeten";
  return "Nog niet gescand";
}

function describeScanSource(source: string | null, magicplanId: string | null): string {
  if (source === "manual_entry") return "Handmatige invoer";
  if (source === "magicplan_mock") return `Testdata${magicplanId ? ` · ${magicplanId}` : ""}`;
  if (source === "magicplan") return `magicplan${magicplanId ? ` · ${magicplanId}` : ""}`;
  return "—";
}

/**
 * `room_dimensions` is untyped JSONB written by two different routes, so it is
 * re-parsed rather than cast — a malformed row renders the "not scanned yet"
 * state instead of crashing the page.
 */
function parseRoomDimensions(input: unknown): RoomDimensions | null {
  if (typeof input !== "object" || input === null) return null;

  const raw = input as Record<string, unknown>;
  const walls = Array.isArray(raw.walls)
    ? raw.walls.map(parseWall).filter((wall): wall is Wall => wall !== null)
    : [];

  if (walls.length === 0) return null;

  const dimensions = raw.dimensions;
  if (typeof dimensions !== "object" || dimensions === null) return null;

  const footprint = dimensions as Record<string, unknown>;
  const numbers = ["width", "depth", "height", "area", "perimeter"] as const;
  if (!numbers.every((key) => typeof footprint[key] === "number")) return null;

  return {
    source: typeof raw.source === "string" ? raw.source : "unknown",
    dimensions: {
      width: footprint.width as number,
      depth: footprint.depth as number,
      height: footprint.height as number,
      area: footprint.area as number,
      perimeter: footprint.perimeter as number,
    },
    walls,
    accuracy: typeof raw.accuracy === "string" ? raw.accuracy : "—",
    scanMethod: raw.scanMethod === "lidar" ? "lidar" : "manual",
  };
}

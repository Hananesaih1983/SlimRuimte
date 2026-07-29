"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import {
  computeFootprint,
  validateWalls,
  type ValidationIssue,
} from "@/lib/scan/geometry";
import { ROOM_TYPES, WALL_LABELS, type Wall } from "@/lib/scan/types";
import { blankWalls, clearDraft } from "@/lib/scan/wizard-storage";
import {
  MissingProject,
  WizardStep,
  manualStepHref,
  useDraft,
  useProjectId,
} from "../wizard-shell";

/** Manual step 4 — review everything, then persist. */
export default function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const projectId = useProjectId(searchParams);
  const draft = useDraft();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) return <MissingProject />;

  const walls = draft.walls.length === 4 ? draft.walls : blankWalls();
  const footprint = computeFootprint(walls);
  const issues = validateWalls(walls);
  const errors = issues.filter((issue) => issue.severity === "error");
  const canSubmit = errors.length === 0;

  const roomType = ROOM_TYPES.find((candidate) => candidate.id === draft.roomType);

  async function submit() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/scan/manual-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          walls,
          roomType: draft.roomType ?? undefined,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Opslaan is mislukt. Probeer het opnieuw.");
        setPending(false);
        return;
      }

      // Only drop the draft once the server has it, so a failed save never
      // costs the user their measurements.
      clearDraft();
      router.push(payload?.redirect ?? `/homeowner/project/${projectId}`);
    } catch {
      setError("Geen verbinding. Controleer je internet en probeer het opnieuw.");
      setPending(false);
    }
  }

  return (
    <WizardStep
      stepIndex={3}
      title="Controleer je maten"
      description="Klopt alles? Dan maken we je plattegrond."
    >
      <div className="grid gap-8 sm:grid-cols-[minmax(0,340px)_1fr]">
        <div className="flex flex-col gap-3">
          <RoomDiagramSVG
            walls={walls}
            className="w-full rounded-xl border border-border"
          />
          <p className="text-xs text-muted-foreground">
            Voorbeeld van je plattegrond. Deuren zijn openingen in de muur, ramen
            een dubbele lijn.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Samenvatting</h2>
            <dl className="grid grid-cols-2 gap-3">
              {roomType ? (
                <Fact label="Ruimte" value={`${roomType.icon} ${roomType.label}`} />
              ) : null}
              <Fact label="Breedte" value={`${footprint.width.toFixed(2)} m`} />
              <Fact label="Diepte" value={`${footprint.depth.toFixed(2)} m`} />
              <Fact label="Hoogte" value={`${footprint.height.toFixed(2)} m`} />
              <Fact label="Oppervlakte" value={`${footprint.area.toFixed(2)} m²`} />
              <Fact label="Omtrek" value={`${footprint.perimeter.toFixed(2)} m`} />
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Muren</h2>
            <ul className="flex flex-col gap-2">
              {walls.map((wall) => (
                <WallSummary key={wall.id} wall={wall} />
              ))}
            </ul>
          </section>

          <ValidationSummary issues={issues} walls={walls} />

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => router.push(manualStepHref(1, projectId!))}
            >
              Aanpassen
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={pending || !canSubmit}
              onClick={submit}
            >
              {pending ? "Opslaan…" : "Plattegrond genereren →"}
            </Button>
          </div>

          {!canSubmit ? (
            <p className="text-xs text-muted-foreground">
              Los eerst de rode punten hierboven op.
            </p>
          ) : null}
        </div>
      </div>
    </WizardStep>
  );
}

function WallSummary({ wall }: { wall: Wall }) {
  const openings = [
    ...wall.doors.map((door) => `deur ${door.width.toFixed(2)} m`),
    ...wall.windows.map((window) => `raam ${window.width.toFixed(2)} m`),
  ];

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <span className="text-sm font-medium">{WALL_LABELS[wall.id]}</span>
      <span className="text-sm text-muted-foreground">
        {Number.isFinite(wall.length) ? wall.length.toFixed(2) : "—"} m ×{" "}
        {Number.isFinite(wall.height) ? wall.height.toFixed(2) : "—"} m
        {openings.length > 0 ? ` · ${openings.join(", ")}` : ""}
      </span>
    </li>
  );
}

/**
 * Green checks for what passed, red for what did not. Showing the passing
 * checks too is deliberate — it tells the user the room genuinely closes rather
 * than just staying silent.
 */
function ValidationSummary({
  issues,
  walls,
}: {
  issues: ValidationIssue[];
  walls: Wall[];
}) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  const allMeasured = walls.every(
    (wall) => Number.isFinite(wall.length) && wall.length > 0,
  );
  const totalOpenings = walls.reduce(
    (total, wall) => total + wall.doors.length + wall.windows.length,
    0,
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Controle</h2>
      <ul className="flex flex-col gap-1.5">
        <Check ok={allMeasured}>Alle vier de muren zijn opgemeten</Check>
        <Check ok={errors.length === 0}>
          De ruimte sluit (tegenoverliggende muren binnen 5 cm)
        </Check>
        <Check ok>
          {totalOpenings > 0
            ? `${totalOpenings} deuren en ramen vastgelegd`
            : "Geen deuren of ramen opgegeven"}
        </Check>

        {[...errors, ...warnings].map((issue, index) => (
          <li
            key={`${issue.wallId ?? "room"}-${index}`}
            className={
              issue.severity === "error"
                ? "flex gap-2 text-sm text-destructive"
                : "flex gap-2 text-sm text-amber-700"
            }
          >
            <span aria-hidden>{issue.severity === "error" ? "✕" : "!"}</span>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "flex gap-2 text-sm" : "flex gap-2 text-sm text-destructive"}>
      <span aria-hidden className={ok ? "text-emerald-600" : undefined}>
        {ok ? "✓" : "✕"}
      </span>
      <span>{children}</span>
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

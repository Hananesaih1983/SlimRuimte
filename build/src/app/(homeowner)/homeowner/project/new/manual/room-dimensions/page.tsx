"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MeasurementInput } from "@/components/scan/MeasurementInput";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import {
  MAX_WALL_HEIGHT_M,
  MAX_WALL_LENGTH_M,
  MIN_WALL_HEIGHT_M,
  MIN_WALL_LENGTH_M,
  OPPOSING_WALL_ERROR,
  isFiniteNumber,
  opposingWallsMatch,
  roundCm,
} from "@/lib/scan/geometry";
import { WALL_IDS, WALL_LABELS, type Wall, type WallId } from "@/lib/scan/types";
import { blankWalls, patchDraft } from "@/lib/scan/wizard-storage";
import {
  MissingProject,
  WizardStep,
  manualStepHref,
  useDraft,
  useProjectId,
} from "../wizard-shell";

/** The wall directly across from each one — the pair that must agree. */
const OPPOSITE: Record<WallId, WallId> = { N: "S", S: "N", E: "W", W: "E" };

/** Manual step 2 — the four wall runs, one at a time. */
export default function RoomDimensionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const projectId = useProjectId(searchParams);
  const draft = useDraft();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) return <MissingProject />;

  const walls = draft.walls.length === 4 ? draft.walls : blankWalls();
  const wallId = WALL_IDS[index];
  const wall = walls.find((candidate) => candidate.id === wallId) ?? blankWalls()[index];

  function updateWall(patch: Partial<Wall>) {
    setError(null);
    patchDraft({
      walls: walls.map((candidate) =>
        candidate.id === wallId ? { ...candidate, ...patch } : candidate,
      ),
    });
  }

  /** Blocks the step until this wall is measurable and closes with its opposite. */
  function validateCurrent(): string | null {
    if (!isFiniteNumber(wall.length)) {
      return `Vul de lengte van muur ${WALL_LABELS[wallId]} in.`;
    }
    if (wall.length < MIN_WALL_LENGTH_M || wall.length > MAX_WALL_LENGTH_M) {
      return `De lengte moet tussen ${MIN_WALL_LENGTH_M} en ${MAX_WALL_LENGTH_M} meter liggen.`;
    }
    if (
      !isFiniteNumber(wall.height) ||
      wall.height < MIN_WALL_HEIGHT_M ||
      wall.height > MAX_WALL_HEIGHT_M
    ) {
      return `De hoogte moet tussen ${MIN_WALL_HEIGHT_M} en ${MAX_WALL_HEIGHT_M} meter liggen.`;
    }

    // Only meaningful once the opposite wall has actually been measured, which
    // is why this fires on walls 3 and 4 rather than on every step.
    const opposite = walls.find((candidate) => candidate.id === OPPOSITE[wallId]);
    if (
      opposite &&
      isFiniteNumber(opposite.length) &&
      !opposingWallsMatch(wall.length, opposite.length)
    ) {
      return OPPOSING_WALL_ERROR;
    }

    return null;
  }

  function goNext() {
    const problem = validateCurrent();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);

    if (index < WALL_IDS.length - 1) {
      setIndex(index + 1);
      return;
    }

    patchDraft({ projectId, walls });
    router.push(manualStepHref(2, projectId!));
  }

  function goBack() {
    setError(null);
    if (index === 0) {
      router.push(manualStepHref(0, projectId!));
      return;
    }
    setIndex(index - 1);
  }

  const opposite = walls.find((candidate) => candidate.id === OPPOSITE[wallId]);

  return (
    <WizardStep
      stepIndex={1}
      title={`Muur ${WALL_LABELS[wallId]}`}
      description="Meet van hoek tot hoek, op ongeveer een meter hoogte."
    >
      <p className="text-sm font-medium text-muted-foreground">
        Muur {index + 1} van {WALL_IDS.length}
      </p>

      <div className="grid gap-8 sm:grid-cols-[minmax(0,320px)_1fr]">
        <RoomDiagramSVG
          walls={walls}
          highlightedWall={wallId}
          className="w-full rounded-xl border border-border"
        />

        <div className="flex flex-col gap-5">
          <MeasurementInput
            label={`Lengte muur ${WALL_LABELS[wallId]}`}
            value={isFiniteNumber(wall.length) ? wall.length : null}
            onChange={(value) =>
              updateWall({ length: value === null ? Number.NaN : roundCm(value) })
            }
            min={MIN_WALL_LENGTH_M}
            max={MAX_WALL_LENGTH_M}
            step={0.01}
            accuracy="±0.5-2 cm"
            placeholder="0.00"
            autoFocus
            hint={
              opposite && isFiniteNumber(opposite.length)
                ? `Tegenoverliggende muur ${WALL_LABELS[OPPOSITE[wallId]]}: ${opposite.length.toFixed(2)} m`
                : undefined
            }
          />

          <MeasurementInput
            label="Hoogte"
            value={isFiniteNumber(wall.height) ? wall.height : null}
            onChange={(value) =>
              updateWall({ height: value === null ? Number.NaN : roundCm(value) })
            }
            min={MIN_WALL_HEIGHT_M}
            max={MAX_WALL_HEIGHT_M}
            step={0.01}
            hint="Standaard 2.60 m — pas aan als je plafond afwijkt."
          />

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={goNext}>
              {index < WALL_IDS.length - 1 ? "Volgende muur →" : "Naar deuren & ramen →"}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={goBack}>
              Terug
            </Button>
          </div>
        </div>
      </div>
    </WizardStep>
  );
}

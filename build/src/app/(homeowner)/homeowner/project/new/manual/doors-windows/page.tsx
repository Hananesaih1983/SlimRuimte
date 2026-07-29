"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MeasurementInput } from "@/components/scan/MeasurementInput";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import { isFiniteNumber, roundCm } from "@/lib/scan/geometry";
import {
  WALL_IDS,
  WALL_LABELS,
  type Opening,
  type Wall,
} from "@/lib/scan/types";
import { blankWalls, patchDraft } from "@/lib/scan/wizard-storage";
import { cn } from "@/lib/utils";
import {
  MissingProject,
  WizardStep,
  manualStepHref,
  useDraft,
  useProjectId,
} from "../wizard-shell";

type OpeningKind = "door" | "window";

/** Sensible starting points so the common case is two taps, not six fields. */
const DEFAULTS: Record<OpeningKind, { width: number; height: number }> = {
  door: { width: 0.9, height: 2.1 },
  window: { width: 1.2, height: 1.4 },
};

const KIND_LABEL: Record<OpeningKind, string> = {
  door: "Deur",
  window: "Raam",
};

/** Manual step 3 — doors and windows, wall by wall. */
export default function DoorsWindowsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const projectId = useProjectId(searchParams);
  const draft = useDraft();
  const [index, setIndex] = useState(0);
  const [adding, setAdding] = useState<OpeningKind | null>(null);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});

  if (!projectId) return <MissingProject />;

  const walls = draft.walls.length === 4 ? draft.walls : blankWalls();
  const wallId = WALL_IDS[index];
  const wall = walls.find((candidate) => candidate.id === wallId) ?? blankWalls()[index];
  const openingCount = wall.doors.length + wall.windows.length;
  const hasOpenings = answered[wallId] ?? openingCount > 0;

  function updateWall(patch: Partial<Wall>) {
    patchDraft({
      walls: walls.map((candidate) =>
        candidate.id === wallId ? { ...candidate, ...patch } : candidate,
      ),
    });
  }

  function addOpening(kind: OpeningKind, opening: Opening) {
    updateWall(
      kind === "door"
        ? { doors: [...wall.doors, opening] }
        : { windows: [...wall.windows, opening] },
    );
    setAdding(null);
  }

  function removeOpening(kind: OpeningKind, position: number) {
    updateWall(
      kind === "door"
        ? { doors: wall.doors.filter((_, i) => i !== position) }
        : { windows: wall.windows.filter((_, i) => i !== position) },
    );
  }

  function goNext() {
    setAdding(null);
    if (index < WALL_IDS.length - 1) {
      setIndex(index + 1);
      return;
    }
    patchDraft({ projectId, walls });
    router.push(manualStepHref(3, projectId!));
  }

  function goBack() {
    setAdding(null);
    if (index === 0) {
      router.push(manualStepHref(1, projectId!));
      return;
    }
    setIndex(index - 1);
  }

  return (
    <WizardStep
      stepIndex={2}
      title={`Muur ${WALL_LABELS[wallId]}`}
      description="Deuren en ramen bepalen straks waar keukenblokken en meubels passen."
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
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">
              Zijn er deuren of ramen in deze muur?
            </legend>
            <div className="flex gap-2">
              <ChoiceButton
                selected={hasOpenings}
                onClick={() => setAnswered({ ...answered, [wallId]: true })}
              >
                Ja
              </ChoiceButton>
              <ChoiceButton
                selected={!hasOpenings}
                onClick={() => {
                  setAnswered({ ...answered, [wallId]: false });
                  setAdding(null);
                  updateWall({ doors: [], windows: [] });
                }}
              >
                Nee
              </ChoiceButton>
            </div>
          </fieldset>

          {hasOpenings ? (
            <div className="flex flex-col gap-4">
              {openingCount > 0 ? (
                <ul className="flex flex-col gap-2">
                  {wall.doors.map((door, position) => (
                    <OpeningRow
                      key={`door-${position}`}
                      kind="door"
                      opening={door}
                      onRemove={() => removeOpening("door", position)}
                    />
                  ))}
                  {wall.windows.map((window, position) => (
                    <OpeningRow
                      key={`window-${position}`}
                      kind="window"
                      opening={window}
                      onRemove={() => removeOpening("window", position)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog niets toegevoegd voor deze muur.
                </p>
              )}

              {adding ? (
                <OpeningForm
                  kind={adding}
                  wallLength={wall.length}
                  onCancel={() => setAdding(null)}
                  onAdd={(opening) => addOpening(adding, opening)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setAdding("door")}
                  >
                    + Deur toevoegen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setAdding("window")}
                  >
                    + Raam toevoegen
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={goNext}>
              {index < WALL_IDS.length - 1 ? "Volgende muur →" : "Naar controleren →"}
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

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "h-10 min-w-20 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function OpeningRow({
  kind,
  opening,
  onRemove,
}: {
  kind: OpeningKind;
  opening: Opening;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="text-sm">
        <span className="font-medium">{KIND_LABEL[kind]}</span>{" "}
        <span className="text-muted-foreground">
          {opening.width.toFixed(2)} × {opening.height.toFixed(2)} m, op{" "}
          {opening.offsetFromLeft.toFixed(2)} m van links
        </span>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        Verwijderen
      </Button>
    </li>
  );
}

function OpeningForm({
  kind,
  wallLength,
  onAdd,
  onCancel,
}: {
  kind: OpeningKind;
  wallLength: number;
  onAdd: (opening: Opening) => void;
  onCancel: () => void;
}) {
  const [width, setWidth] = useState<number | null>(DEFAULTS[kind].width);
  const [height, setHeight] = useState<number | null>(DEFAULTS[kind].height);
  const [offset, setOffset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!isFiniteNumber(width) || width <= 0) {
      setError("Vul een geldige breedte in.");
      return;
    }
    if (!isFiniteNumber(height) || height <= 0) {
      setError("Vul een geldige hoogte in.");
      return;
    }
    if (!isFiniteNumber(offset) || offset < 0) {
      setError("Vul in hoeveel meter vanaf de linkerhoek dit begint.");
      return;
    }
    // Caught again server-side, but far friendlier to say it here than to let
    // the user finish the wizard and be rejected on the review screen.
    if (isFiniteNumber(wallLength) && offset + width > wallLength + 1e-9) {
      setError(
        `Dit past niet: ${roundCm(offset + width).toFixed(2)} m op een muur van ${wallLength.toFixed(2)} m.`,
      );
      return;
    }

    onAdd({
      width: roundCm(width),
      height: roundCm(height),
      offsetFromLeft: roundCm(offset),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">{KIND_LABEL[kind]} toevoegen</p>

      <MeasurementInput label="Breedte" value={width} onChange={setWidth} min={0.1} autoFocus />
      <MeasurementInput label="Hoogte" value={height} onChange={setHeight} min={0.1} />
      <MeasurementInput
        label="Afstand vanaf linkerhoek"
        value={offset}
        onChange={setOffset}
        min={0}
        placeholder="0.00"
        hint="Gemeten vanaf de linkerhoek als je tegen deze muur aan kijkt."
      />

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" onClick={submit}>
          Toevoegen
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

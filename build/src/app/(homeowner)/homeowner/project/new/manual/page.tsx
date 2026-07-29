"use client";

import { useRouter } from "next/navigation";
import { ROOM_TYPES, type RoomTypeId } from "@/lib/scan/types";
import { blankWalls, patchDraft, readDraft } from "@/lib/scan/wizard-storage";
import { cn } from "@/lib/utils";
import {
  MissingProject,
  WizardStep,
  manualStepHref,
  useDraft,
  useProjectId,
} from "./wizard-shell";

/** Manual step 1 — what kind of room is being measured. */
export default function ManualRoomTypePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const projectId = useProjectId(searchParams);
  const draft = useDraft();

  if (!projectId) return <MissingProject />;

  function select(roomType: RoomTypeId) {
    if (!projectId) return;

    // Seed the wall set here so step 2 always opens on a complete form, even if
    // the draft was empty (fresh start) or belongs to an older project.
    const existing = readDraft();
    patchDraft({
      projectId,
      roomType,
      walls: existing.walls.length === 4 ? existing.walls : blankWalls(),
    });

    router.push(manualStepHref(1, projectId));
  }

  return (
    <WizardStep
      stepIndex={0}
      title="Welke ruimte ga je meten?"
      description="Zo weten we welke details straks belangrijk zijn voor je plattegrond."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROOM_TYPES.map((roomType) => (
          <button
            key={roomType.id}
            type="button"
            onClick={() => select(roomType.id)}
            aria-pressed={draft.roomType === roomType.id}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              draft.roomType === roomType.id
                ? "border-primary bg-primary/5"
                : "border-border bg-background",
            )}
          >
            <span aria-hidden className="text-2xl">
              {roomType.icon}
            </span>
            <span className="text-sm font-medium">{roomType.label}</span>
          </button>
        ))}
      </div>
    </WizardStep>
  );
}

"use client";

import Link from "next/link";
import { use, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { isUuid } from "@/lib/uuid";
import {
  getDraftSnapshot,
  getServerDraftSnapshot,
  subscribeToDraft,
  type WizardDraft,
} from "@/lib/scan/wizard-storage";

/**
 * Shared chrome and state loading for the four manual-measurement steps.
 *
 * The draft lives in sessionStorage, which does not exist during the server
 * render, so it is loaded in an effect rather than during render — reading it
 * inline would produce markup the client immediately contradicts and trip a
 * hydration mismatch. Steps get `null` for one paint and render a placeholder.
 */

export const MANUAL_STEPS = [
  { path: "", label: "Ruimte" },
  { path: "/room-dimensions", label: "Muren" },
  { path: "/doors-windows", label: "Deuren & ramen" },
  { path: "/review", label: "Controleren" },
] as const;

const BASE_PATH = "/homeowner/project/new/manual";

export function manualStepHref(stepIndex: number, projectId: string): string {
  const step = MANUAL_STEPS[stepIndex] ?? MANUAL_STEPS[0];
  return `${BASE_PATH}${step.path}?projectId=${encodeURIComponent(projectId)}`;
}

/**
 * Subscribes to the wizard draft.
 *
 * Every write goes through `patchDraft`, which notifies the store, so each step
 * re-renders from one source of truth and no step keeps a private copy that can
 * drift out of sync with sessionStorage.
 */
export function useDraft(): WizardDraft {
  return useSyncExternalStore(
    subscribeToDraft,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );
}

/** Resolves `?projectId=` from the page's promised searchParams. */
export function useProjectId(
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>,
): string | null {
  const resolved = use(searchParams);
  const projectId = resolved.projectId;
  return isUuid(projectId) ? projectId : null;
}

export function WizardStep({
  stepIndex,
  title,
  description,
  children,
}: {
  stepIndex: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <StepIndicator current={stepIndex} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>

      {children}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {MANUAL_STEPS.map((step, index) => (
        <li key={step.path} className="flex items-center gap-2">
          <span
            className={
              index === current
                ? "font-semibold text-primary"
                : index < current
                  ? "text-foreground"
                  : "text-muted-foreground"
            }
          >
            {index + 1}. {step.label}
          </span>
          {index < MANUAL_STEPS.length - 1 ? (
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Shown when the step is reached without a usable `?projectId=`. */
export function MissingProject() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Project ontbreekt</h1>
      <p className="text-sm text-muted-foreground">
        We konden dit project niet vinden. Start het meten opnieuw.
      </p>
      <Link
        href="/homeowner/project/new"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Opnieuw beginnen
      </Link>
    </div>
  );
}

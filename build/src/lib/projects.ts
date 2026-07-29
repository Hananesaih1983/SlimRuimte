/**
 * Project lifecycle constants shared by the scan routes.
 *
 * The `status` values here MUST stay inside the CHECK constraint on
 * `public.projects.status` in `src/lib/supabase/migrations/001_init.sql`:
 *
 *   draft, scanning, renders_pending, renders_done, brief_approved, brief_sent,
 *   designer_matched, contractor_matched, in_progress, complete, archived
 */

export const PROJECT_STATUS_DRAFT = "draft";
export const PROJECT_STATUS_SCANNING = "scanning";

/**
 * Status a project lands in once its floor plan data is captured and validated.
 *
 * The Week 2 brief called this `plan_ready`, but that value is not in the
 * status CHECK constraint on the live database, so writing it would fail with a
 * 23514 and break both scan paths at the final step. `renders_pending` is the
 * schema's existing "scan is done, next stage is renders" state, which is the
 * same point in the funnel. If `plan_ready` is genuinely wanted as a distinct
 * state, it needs a migration that extends the CHECK constraint first — then
 * only this constant changes.
 */
export const PROJECT_STATUS_PLAN_READY = "renders_pending";

/** Values accepted by the `renovation_type` CHECK constraint. */
export const RENOVATION_TYPES = [
  "kitchen",
  "bathroom",
  "living_room",
  "bedroom",
  "open_plan",
  "extension",
  "other",
] as const;

export type RenovationType = (typeof RENOVATION_TYPES)[number];

export function isRenovationType(value: unknown): value is RenovationType {
  return (
    typeof value === "string" &&
    (RENOVATION_TYPES as readonly string[]).includes(value)
  );
}

/** Values accepted by the `country` CHECK constraint. */
export const COUNTRIES = ["NL", "BE"] as const;

export type Country = (typeof COUNTRIES)[number];

export const DEFAULT_COUNTRY: Country = "NL";

export function isCountry(value: unknown): value is Country {
  return typeof value === "string" && (COUNTRIES as readonly string[]).includes(value);
}

/** Human-readable Dutch labels for the statuses the homeowner can actually see. */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Concept",
  scanning: "Wordt gescand",
  renders_pending: "Plattegrond klaar",
  renders_done: "Visualisaties klaar",
  brief_approved: "Briefing goedgekeurd",
  brief_sent: "Briefing verstuurd",
  designer_matched: "Ontwerper gekoppeld",
  contractor_matched: "Aannemer gekoppeld",
  in_progress: "In uitvoering",
  complete: "Afgerond",
  archived: "Gearchiveerd",
};

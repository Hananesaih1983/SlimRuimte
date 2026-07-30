import {
  OPPOSING_WALLS,
  WALL_IDS,
  WALL_LABELS,
  type Opening,
  type RoomFootprint,
  type Wall,
  type WallId,
} from "./types";

/**
 * Geometry + validation for the scan flow.
 *
 * Deliberately dependency-free and pure so the exact same rules run in the
 * browser (live feedback in the wizard) and on the server (the check that
 * actually gates the write). The client copy is a convenience; the server call
 * in /api/scan/manual-save is the one that counts.
 */

/** A rectangular room only closes if each opposing pair agrees within 5 cm. */
export const WALL_MATCH_TOLERANCE_M = 0.05;

/** Input bounds for a single wall run, matching the wizard's number inputs. */
export const MIN_WALL_LENGTH_M = 0.5;
export const MAX_WALL_LENGTH_M = 50;
export const MIN_WALL_HEIGHT_M = 1.5;
export const MAX_WALL_HEIGHT_M = 10;
export const DEFAULT_WALL_HEIGHT_M = 2.6;

export const OPPOSING_WALL_ERROR =
  "De tegenoverliggende muren verschillen meer dan 5cm. Controleer je meting.";

/** Rounds to centimetre precision — the finest unit any scan path can resolve. */
export function roundCm(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * True when both members of an opposing pair are present and agree within
 * tolerance. Missing walls are "not yet failing" so the wizard can validate
 * incrementally as the user fills walls in.
 */
export function opposingWallsMatch(
  a: number | undefined,
  b: number | undefined,
): boolean {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return true;
  return Math.abs(a - b) <= WALL_MATCH_TOLERANCE_M + 1e-9;
}

/**
 * Averages each opposing pair into a single width/depth.
 *
 * Averaging rather than picking one wall halves the error when the two
 * measurements disagree slightly — and they always disagree slightly, because
 * real walls are not perfectly parallel.
 */
export function computeFootprint(walls: Wall[], height?: number): RoomFootprint {
  const byId = new Map(walls.map((wall) => [wall.id, wall]));

  // Unmeasured walls carry NaN (see `blankWalls`), and `?? 0` does not catch
  // that — NaN is neither null nor undefined. Without the finite check a single
  // empty input poisons every derived number and the review screen renders
  // "NaN m²" instead of a partial footprint.
  const lengthOf = (id: WallId) => {
    const length = byId.get(id)?.length;
    return isFiniteNumber(length) ? length : 0;
  };

  const width = roundCm((lengthOf("N") + lengthOf("S")) / 2);
  const depth = roundCm((lengthOf("E") + lengthOf("W")) / 2);

  const heights = walls.map((wall) => wall.height).filter(isFiniteNumber);
  const resolvedHeight = isFiniteNumber(height)
    ? roundCm(height)
    : heights.length > 0
      ? roundCm(heights.reduce((sum, h) => sum + h, 0) / heights.length)
      : DEFAULT_WALL_HEIGHT_M;

  return {
    width,
    depth,
    height: resolvedHeight,
    area: roundCm(width * depth),
    perimeter: roundCm(2 * (width + depth)),
  };
}

export type ValidationIssue = {
  /** `null` for whole-room issues (e.g. a missing wall set). */
  wallId: WallId | null;
  message: string;
  severity: "error" | "warning";
};

/**
 * Full server-side validation of a wall set.
 *
 * Returns every problem rather than throwing on the first, so the review screen
 * can show a complete checklist instead of making the user resubmit repeatedly.
 */
export function validateWalls(walls: Wall[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(walls.map((wall) => [wall.id, wall]));

  for (const id of WALL_IDS) {
    const wall = byId.get(id);
    if (!wall) {
      issues.push({
        wallId: id,
        message: `Muur ${WALL_LABELS[id]} ontbreekt.`,
        severity: "error",
      });
      continue;
    }

    if (
      !isFiniteNumber(wall.length) ||
      wall.length < MIN_WALL_LENGTH_M ||
      wall.length > MAX_WALL_LENGTH_M
    ) {
      issues.push({
        wallId: id,
        message: `Lengte van muur ${WALL_LABELS[id]} moet tussen ${MIN_WALL_LENGTH_M} en ${MAX_WALL_LENGTH_M} meter liggen.`,
        severity: "error",
      });
    }

    if (
      !isFiniteNumber(wall.height) ||
      wall.height < MIN_WALL_HEIGHT_M ||
      wall.height > MAX_WALL_HEIGHT_M
    ) {
      issues.push({
        wallId: id,
        message: `Hoogte van muur ${WALL_LABELS[id]} moet tussen ${MIN_WALL_HEIGHT_M} en ${MAX_WALL_HEIGHT_M} meter liggen.`,
        severity: "error",
      });
    }

    issues.push(...validateOpenings(wall));
  }

  for (const [a, b] of OPPOSING_WALLS) {
    const wallA = byId.get(a);
    const wallB = byId.get(b);
    if (!wallA || !wallB) continue;
    if (!opposingWallsMatch(wallA.length, wallB.length)) {
      issues.push({ wallId: a, message: OPPOSING_WALL_ERROR, severity: "error" });
    }
  }

  return issues;
}

/**
 * An opening must fit inside the wall that holds it — a 1.2 m window 4 m along a
 * 4.2 m wall would otherwise produce a floor plan that cannot be built.
 */
function validateOpenings(wall: Wall): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const groups: Array<[string, Opening[]]> = [
    ["Deur", wall.doors],
    ["Raam", wall.windows],
  ];

  for (const [noun, openings] of groups) {
    for (const opening of openings) {
      if (
        !isFiniteNumber(opening.width) ||
        !isFiniteNumber(opening.height) ||
        !isFiniteNumber(opening.offsetFromLeft) ||
        opening.width <= 0 ||
        opening.height <= 0 ||
        opening.offsetFromLeft < 0
      ) {
        issues.push({
          wallId: wall.id,
          message: `${noun} in muur ${WALL_LABELS[wall.id]} heeft ongeldige maten.`,
          severity: "error",
        });
        continue;
      }

      if (
        isFiniteNumber(wall.length) &&
        opening.offsetFromLeft + opening.width > wall.length + 1e-9
      ) {
        issues.push({
          wallId: wall.id,
          message: `${noun} in muur ${WALL_LABELS[wall.id]} valt buiten de muur (${roundCm(
            opening.offsetFromLeft + opening.width,
          ).toFixed(2)} m op een muur van ${wall.length.toFixed(2)} m).`,
          severity: "error",
        });
      }

      if (isFiniteNumber(wall.height) && opening.height > wall.height + 1e-9) {
        issues.push({
          wallId: wall.id,
          message: `${noun} in muur ${WALL_LABELS[wall.id]} is hoger dan de muur.`,
          severity: "error",
        });
      }
    }
  }

  return issues;
}

/** Convenience wrapper: does this wall set close into a usable rectangle? */
export function roomCloses(walls: Wall[]): boolean {
  return validateWalls(walls).every((issue) => issue.severity !== "error");
}

/** Normalises unknown JSON into a `Wall`, dropping anything malformed. */
export function parseWall(input: unknown): Wall | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const id = raw.id;
  if (!(typeof id === "string" && (WALL_IDS as readonly string[]).includes(id))) {
    return null;
  }
  const wallId = id as WallId;

  const length = toMeasurement(raw.length);
  const height = toMeasurement(raw.height);
  if (length === null || height === null) return null;

  return {
    id: wallId,
    label: typeof raw.label === "string" ? raw.label : WALL_LABELS[wallId],
    length: roundCm(length),
    height: roundCm(height),
    doors: parseOpenings(raw.doors),
    windows: parseOpenings(raw.windows),
  };
}

/**
 * Coerces one untrusted JSON value into a measurement, or `null` if it is not
 * one.
 *
 * Bare `Number()` is too generous to use on a request body: `Number(null)`,
 * `Number("")` and `Number([])` are all 0, and `Number(true)` is 1. A hand-rolled
 * POST of `{"id":"N","length":[],"height":true}` therefore used to parse cleanly
 * into a 0 m x 1 m wall and only get caught downstream by the range check —
 * which is a coincidence, not a guarantee, and would not have held for openings
 * (`parseOpenings` has no range check of its own, so `width: true` became a real
 * 1 m door). Only actual numbers and numeric strings are accepted here.
 */
function toMeasurement(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;

  const trimmed = input.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOpenings(input: unknown): Opening[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((entry): Opening[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const raw = entry as Record<string, unknown>;
    const width = toMeasurement(raw.width);
    const height = toMeasurement(raw.height);
    const offsetFromLeft = toMeasurement(raw.offsetFromLeft);

    if (width === null || height === null || offsetFromLeft === null) {
      return [];
    }

    return [
      {
        width: roundCm(width),
        height: roundCm(height),
        offsetFromLeft: roundCm(offsetFromLeft),
      },
    ];
  });
}

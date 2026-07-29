import { roundCm } from "./geometry";
import {
  OPPOSING_WALLS,
  WALL_IDS,
  WALL_LABELS,
  type Opening,
  type Wall,
  type WallId,
} from "./types";

/**
 * Apple RoomPlan (`CapturedRoom`) → our `Wall[]`.
 *
 * The Room.json a homeowner exports from the 3D Scanner App is ARKit's own
 * structure: a flat list of surfaces, each with `dimensions` (x = the run along
 * the surface, y = its height) and a `transform` placing it in a Y-up world, so
 * the floor plane is XZ. There are no compass labels and no room outline — the
 * mapping onto N/E/S/W is ours to make.
 *
 * Kept pure and dependency-free like `geometry.ts`, so it can be exercised
 * against real exports without a request or a database.
 */

/**
 * How far off a wall plane an opening may sit and still be counted as part of
 * that wall. Generous next to a wall's own thickness (~10 cm) but far below the
 * distance to the opposite wall in even a very small room.
 */
const OPENING_PROXIMITY_M = 0.75;

/** One parsed RoomPlan surface, reduced to the numbers a floor plan needs. */
type Surface = {
  /** `dimensions.x` — the run along the surface, in metres. */
  length: number;
  /** `dimensions.y` — height, in metres. */
  height: number;
  cx: number;
  cz: number;
  /** `null` when the transform carried no usable rotation. */
  alongX: boolean | null;
};

/** A resolved compass wall: possibly several collinear RoomPlan segments. */
type Run = {
  /** True for N/S, which run along world X. */
  alongX: boolean;
  /** World coordinate of the run's "left" end — x for N/S, z for E/W. */
  start: number;
  length: number;
  height: number;
  /** The wall plane's perpendicular coordinate — z for N/S, x for E/W. */
  plane: number;
  /** True when this wall was inferred from its opposite, not captured. */
  mirrored: boolean;
};

/**
 * Returns the four walls of the scanned room, or `null` when the scan does not
 * describe a closed room (no usable walls, or a whole opposing pair missing).
 */
export function parseCapturedRoom(payload: Record<string, unknown>): Wall[] | null {
  const surfaces = asArray(payload.walls)
    .map(parseSurface)
    .filter((surface): surface is Surface => surface !== null);

  if (surfaces.length === 0) return null;

  const runs = resolveRuns(surfaces);
  if (!runs) return null;

  const doors = assignOpenings(runs, parseSurfaces(payload.doors));
  const windows = assignOpenings(runs, parseSurfaces(payload.windows));

  return WALL_IDS.map((id) => {
    const run = runs.get(id)!;

    return {
      id,
      label: WALL_LABELS[id],
      length: roundCm(run.length),
      height: roundCm(run.height),
      doors: doors.get(id) ?? [],
      windows: windows.get(id) ?? [],
    };
  });
}

/**
 * Buckets each captured wall into a compass slot, then collapses each slot into
 * a single run.
 *
 * Orientation comes from the transform's rotation; the side (N vs S, E vs W)
 * from which half of the room the wall sits in. RoomPlan splits a long wall into
 * several segments often enough that a slot has to accept more than one surface
 * — those are merged by taking the outer extent, which is the run a floor plan
 * needs rather than the sum of the pieces.
 */
function resolveRuns(walls: Surface[]): Map<WallId, Run> | null {
  const centre = {
    x: mean(walls.map((wall) => wall.cx)),
    z: mean(walls.map((wall) => wall.cz)),
  };

  const buckets = new Map<WallId, Surface[]>();

  walls.forEach((wall, index) => {
    // RoomPlan walks the room wall by wall, so consecutive walls alternate axis
    // — the fallback when a transform carried no rotation to read.
    const alongX = wall.alongX ?? index % 2 === 0;
    const id: WallId = alongX
      ? wall.cz <= centre.z
        ? "N"
        : "S"
      : wall.cx <= centre.x
        ? "W"
        : "E";

    const bucket = buckets.get(id);
    if (bucket) bucket.push(wall);
    else buckets.set(id, [wall]);
  });

  const runs = new Map<WallId, Run>();

  for (const [id, group] of buckets) {
    const alongX = id === "N" || id === "S";
    const along = (surface: Surface) => (alongX ? surface.cx : surface.cz);
    const perpendicular = (surface: Surface) => (alongX ? surface.cz : surface.cx);

    const start = Math.min(...group.map((s) => along(s) - s.length / 2));
    const end = Math.max(...group.map((s) => along(s) + s.length / 2));

    runs.set(id, {
      alongX,
      start,
      length: end - start,
      // Tallest segment, not the average: RoomPlan sometimes emits a low stub
      // alongside the full-height run, and the ceiling is what we want.
      height: Math.max(...group.map((s) => s.height)),
      plane: mean(group.map(perpendicular)),
      mirrored: false,
    });
  }

  // A rectangle's opposing walls are equal, so one missing wall is recoverable.
  // Both members of a pair missing means the scan never closed — reject it
  // rather than persist a room with a zero-width axis.
  for (const [a, b] of OPPOSING_WALLS) {
    const runA = runs.get(a);
    const runB = runs.get(b);

    if (!runA && !runB) return null;
    if (!runA) runs.set(a, mirror(runB!, centre));
    if (!runB) runs.set(b, mirror(runA!, centre));
  }

  return runs;
}

/** Reflects a run across the room centre to stand in for its missing opposite. */
function mirror(run: Run, centre: { x: number; z: number }): Run {
  const axisCentre = run.alongX ? centre.z : centre.x;

  return { ...run, plane: 2 * axisCentre - run.plane, mirrored: true };
}

/**
 * Attaches each door/window to the wall whose plane it sits closest to.
 *
 * `offsetFromLeft` is measured from the run's left end in the direction the
 * floor plan draws it — increasing x for N/S, increasing z for E/W — which is
 * exactly the convention `Opening` documents.
 *
 * Mirrored walls are skipped: they are an inference, so an opening must never be
 * pulled onto one.
 */
function assignOpenings(
  runs: Map<WallId, Run>,
  surfaces: Surface[],
): Map<WallId, Opening[]> {
  const byWall = new Map<WallId, Opening[]>();

  for (const surface of surfaces) {
    let best: { id: WallId; run: Run; distance: number } | null = null;

    for (const [id, run] of runs) {
      if (run.mirrored) continue;

      const distance = Math.abs(
        (run.alongX ? surface.cz : surface.cx) - run.plane,
      );
      if (distance > OPENING_PROXIMITY_M) continue;
      if (!best || distance < best.distance) best = { id, run, distance };
    }

    if (!best) continue;

    const { id, run } = best;

    // Clamped to the wall it lands in, so the result always satisfies the same
    // "openings fit inside their wall" rule the manual path is validated against.
    const width = Math.min(surface.length, run.length);
    const along = run.alongX ? surface.cx : surface.cz;
    const offset = along - run.start - surface.length / 2;

    const opening: Opening = {
      width: roundCm(width),
      height: roundCm(Math.min(surface.height, run.height)),
      offsetFromLeft: roundCm(
        Math.min(Math.max(offset, 0), Math.max(0, run.length - width)),
      ),
    };

    const list = byWall.get(id);
    if (list) list.push(opening);
    else byWall.set(id, [opening]);
  }

  return byWall;
}

function parseSurfaces(input: unknown): Surface[] {
  return asArray(input)
    .map(parseSurface)
    .filter((surface): surface is Surface => surface !== null);
}

function parseSurface(input: unknown): Surface | null {
  if (typeof input !== "object" || input === null) return null;

  const raw = input as Record<string, unknown>;
  const dimensions = parseVec3(raw.dimensions);

  if (!dimensions || dimensions.x <= 0 || dimensions.y <= 0) return null;

  const placement = parseTransform(raw.transform);

  return {
    length: dimensions.x,
    height: dimensions.y,
    cx: placement?.cx ?? 0,
    cz: placement?.cz ?? 0,
    alongX: placement?.alongX ?? null,
  };
}

/**
 * Reads a surface's position and orientation out of its transform.
 *
 * `simd_float4x4` encodes as 16 column-major floats, so column 0 is the local X
 * axis in world space (the direction the surface runs) and column 3 is the
 * translation. Codable emits that flat, nested, or under `columns` depending on
 * the exporter, and some tools ship only a translation — all are accepted, with
 * orientation reported as `null` when there is no rotation to read.
 */
function parseTransform(
  input: unknown,
): { cx: number; cz: number; alongX: boolean | null } | null {
  if (typeof input !== "object" || input === null) return null;

  const raw = input as Record<string, unknown>;
  const flat = Array.isArray(input)
    ? collectNumbers(input)
    : collectNumbers(raw.columns ?? raw.matrix ?? raw.m);

  if (flat.length >= 16) {
    return {
      cx: flat[12],
      cz: flat[14],
      alongX: Math.abs(flat[0]) >= Math.abs(flat[2]),
    };
  }

  const translation = parseVec3(raw.translation ?? raw.position ?? raw.center ?? raw);
  if (translation) {
    return { cx: translation.x, cz: translation.z, alongX: null };
  }

  return null;
}

/** Accepts `{x, y, z}` and `[x, y, z]`; `z` defaults to 0 for 2D dimensions. */
function parseVec3(input: unknown): { x: number; y: number; z: number } | null {
  if (Array.isArray(input)) {
    const numbers = collectNumbers(input);
    return numbers.length >= 3
      ? { x: numbers[0], y: numbers[1], z: numbers[2] }
      : null;
  }

  if (typeof input !== "object" || input === null) return null;

  const raw = input as Record<string, unknown>;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z ?? 0);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y, z: Number.isFinite(z) ? z : 0 };
}

function collectNumbers(input: unknown): number[] {
  if (typeof input === "number") return Number.isFinite(input) ? [input] : [];
  if (Array.isArray(input)) return input.flatMap(collectNumbers);
  return [];
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

"use client";

import {
  WALL_IDS,
  WALL_LABELS,
  type RoomTypeId,
  type Wall,
  isRoomTypeId,
  isWallId,
} from "./types";
import { DEFAULT_WALL_HEIGHT_M, parseWall } from "./geometry";

/**
 * Draft state for the manual measurement wizard, exposed as an external store.
 *
 * Held in sessionStorage rather than a context provider because each wizard step
 * is its own route: a full navigation between steps would tear down any
 * in-memory provider, and a hard refresh mid-wizard is exactly when a user is
 * most annoyed to lose four wall measurements. sessionStorage survives both and
 * clears itself when the tab closes, so a half-measured room never leaks into a
 * later session.
 *
 * It is shaped as a subscribe/getSnapshot store so components can read it via
 * `useSyncExternalStore`. That handles the awkward part for us: sessionStorage
 * does not exist during the server render, and React knows to use
 * `getServerDraftSnapshot()` for that pass and swap in the real value on
 * hydration — no effect, no setState-in-effect, no hydration mismatch.
 *
 * Nothing here is trusted: /api/scan/manual-save re-validates and recomputes
 * every number before it touches the database.
 */

const STORAGE_KEY = "slimruimte:scan-wizard";

export type WizardDraft = {
  projectId: string | null;
  roomType: RoomTypeId | null;
  walls: Wall[];
};

export function emptyDraft(): WizardDraft {
  return { projectId: null, roomType: null, walls: [] };
}

/**
 * Frozen snapshot for the server render and for hydration.
 *
 * Must be a stable reference — `useSyncExternalStore` compares snapshots by
 * identity, and returning a fresh object each call would re-render forever.
 */
const SERVER_SNAPSHOT: WizardDraft = Object.freeze({
  projectId: null,
  roomType: null,
  walls: Object.freeze([]) as unknown as Wall[],
}) as WizardDraft;

/** A wall set pre-filled with defaults, used when the user first reaches step 2. */
export function blankWalls(): Wall[] {
  return WALL_IDS.map((id) => ({
    id,
    label: WALL_LABELS[id],
    length: Number.NaN,
    height: DEFAULT_WALL_HEIGHT_M,
    doors: [],
    windows: [],
  }));
}

/** Cached snapshot. `null` means "not read from storage yet". */
let cache: WizardDraft | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Identity-stable while unchanged, as `useSyncExternalStore` requires. */
export function getDraftSnapshot(): WizardDraft {
  if (cache === null) {
    cache = loadFromStorage();
  }
  return cache;
}

export function getServerDraftSnapshot(): WizardDraft {
  return SERVER_SNAPSHOT;
}

export function readDraft(): WizardDraft {
  return getDraftSnapshot();
}

export function writeDraft(draft: WizardDraft): void {
  cache = draft;

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage disabled or full — the in-memory cache still drives this tab.
    }
  }

  notify();
}

export function patchDraft(patch: Partial<WizardDraft>): WizardDraft {
  const next = { ...getDraftSnapshot(), ...patch };
  writeDraft(next);
  return next;
}

export function clearDraft(): void {
  cache = emptyDraft();

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do — a stale draft is overwritten on the next run anyway.
    }
  }

  notify();
}

function loadFromStorage(): WizardDraft {
  if (typeof window === "undefined") return emptyDraft();

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft();

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyDraft();

    const draft = parsed as Record<string, unknown>;
    const walls = Array.isArray(draft.walls)
      ? draft.walls.map(parseDraftWall).filter((wall): wall is Wall => wall !== null)
      : [];

    return {
      projectId: typeof draft.projectId === "string" ? draft.projectId : null,
      roomType: isRoomTypeId(draft.roomType) ? draft.roomType : null,
      walls,
    };
  } catch {
    // Private-mode quota errors and hand-edited storage both land here.
    return emptyDraft();
  }
}

/**
 * Draft-tolerant wall parser: keeps "not measured yet" as `NaN`.
 *
 * A half-finished draft is the normal case here, and `JSON.stringify` turns the
 * `NaN` that `blankWalls()` uses for an unmeasured run into `null`. The strict
 * `parseWall` used by the API correctly rejects that, which on reload dropped
 * every blank wall, left fewer than four, and made each step fall back to
 * `blankWalls()` — silently discarding the walls the user HAD measured. That is
 * exactly the refresh this module exists to survive.
 *
 * Anything genuinely malformed (bad id, non-numeric text) is still rejected;
 * only "absent" is treated as unmeasured. Nothing loosened here can reach the
 * database: /api/scan/manual-save re-parses with `parseWall` and re-validates.
 */
function parseDraftWall(input: unknown): Wall | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (!isWallId(raw.id)) return null;

  // Substituting a placeholder for each measurement in turn lets the strict
  // parser do all the normalisation (label, rounding, openings) while telling us
  // which of the two the draft actually carried.
  const shape = parseWall({ ...raw, length: 1, height: DEFAULT_WALL_HEIGHT_M });
  if (!shape) return null;

  const withLength = parseWall({ ...raw, height: DEFAULT_WALL_HEIGHT_M });
  const withHeight = parseWall({ ...raw, length: 1 });

  return {
    ...shape,
    length: withLength ? withLength.length : Number.NaN,
    height: withHeight ? withHeight.height : DEFAULT_WALL_HEIGHT_M,
  };
}

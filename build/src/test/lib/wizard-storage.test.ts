import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  blankWalls,
  clearDraft,
  emptyDraft,
  getDraftSnapshot,
  getServerDraftSnapshot,
  patchDraft,
  readDraft,
  subscribeToDraft,
  writeDraft,
} from "@/lib/scan/wizard-storage";

/**
 * The store is a module singleton with a private `cache`, so these tests must
 * reset it between cases the same way the app does — `clearDraft()` — rather
 * than by reaching into module internals. Clearing sessionStorage too, because
 * a leftover key would be reloaded by the next `getDraftSnapshot()`.
 */

const STORAGE_KEY = "slimruimte:scan-wizard";

beforeEach(() => {
  window.sessionStorage.clear();
  clearDraft();
});

describe("emptyDraft", () => {
  it("returns the empty wizard shape", () => {
    expect(emptyDraft()).toEqual({ projectId: null, roomType: null, walls: [] });
  });

  it("returns a fresh object each call, so callers cannot alias the store", () => {
    const first = emptyDraft();
    const second = emptyDraft();

    expect(first).not.toBe(second);

    first.walls.push(blankWalls()[0]);
    expect(second.walls).toHaveLength(0);
  });
});

describe("getServerDraftSnapshot", () => {
  it("returns the same reference on every call", () => {
    // useSyncExternalStore compares snapshots by identity. A fresh object per
    // call is an infinite re-render loop, not a cosmetic issue.
    expect(getServerDraftSnapshot()).toBe(getServerDraftSnapshot());
  });

  it("is empty and frozen", () => {
    const snapshot = getServerDraftSnapshot();

    expect(snapshot).toEqual({ projectId: null, roomType: null, walls: [] });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.walls)).toBe(true);
  });

  it("is unaffected by client-side writes", () => {
    const before = getServerDraftSnapshot();
    patchDraft({ projectId: "abc" });

    expect(getServerDraftSnapshot()).toBe(before);
    expect(getServerDraftSnapshot().projectId).toBeNull();
  });
});

describe("getDraftSnapshot", () => {
  it("is identity-stable while nothing changes", () => {
    expect(getDraftSnapshot()).toBe(getDraftSnapshot());
  });

  it("returns a new reference after a write, so subscribers see a change", () => {
    const before = getDraftSnapshot();
    patchDraft({ roomType: "kitchen" });

    expect(getDraftSnapshot()).not.toBe(before);
  });

  /**
   * The cache starts null only once per module instance, so reaching the
   * rehydration path means re-importing the module — which is exactly what a
   * refresh mid-wizard does in the browser.
   */
  async function freshStore() {
    vi.resetModules();
    return import("@/lib/scan/wizard-storage");
  }

  it("rehydrates a stored draft on first read after a refresh", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId: "p-1", roomType: "bathroom", walls: [] }),
    );

    const store = await freshStore();
    expect(store.getDraftSnapshot()).toEqual({
      projectId: "p-1",
      roomType: "bathroom",
      walls: [],
    });
  });

  it("keeps unmeasured walls as NaN across a refresh instead of dropping them", async () => {
    // JSON.stringify turns NaN into null. A strict re-parse would drop every
    // blank wall, leave fewer than four, and silently discard the walls the
    // user HAD measured — the exact refresh this module exists to survive.
    const walls = blankWalls();
    walls[0] = { ...walls[0], length: 4.2 };
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId: "p-1", roomType: null, walls }),
    );

    const store = await freshStore();
    const restored = store.getDraftSnapshot().walls;

    expect(restored).toHaveLength(4);
    expect(restored[0].length).toBe(4.2);
    expect(Number.isNaN(restored[1].length)).toBe(true);
  });

  it("falls back to an empty draft when storage holds garbage", async () => {
    window.sessionStorage.setItem(STORAGE_KEY, "{not json");

    const store = await freshStore();
    expect(store.getDraftSnapshot()).toEqual({ projectId: null, roomType: null, walls: [] });
  });

  it("drops a hand-edited wall with an unknown id", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectId: null,
        roomType: null,
        walls: [{ id: "X", length: 3, height: 2.6, doors: [], windows: [] }],
      }),
    );

    const store = await freshStore();
    expect(store.getDraftSnapshot().walls).toHaveLength(0);
  });

  it("ignores a roomType that is not one of the known room types", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId: null, roomType: "dungeon", walls: [] }),
    );

    const store = await freshStore();
    expect(store.getDraftSnapshot().roomType).toBeNull();
  });
});

describe("patchDraft", () => {
  it("merges the patched fields and leaves the rest alone", () => {
    patchDraft({ projectId: "p-1" });
    patchDraft({ roomType: "kitchen" });

    expect(readDraft()).toEqual({ projectId: "p-1", roomType: "kitchen", walls: [] });
  });

  it("returns the merged draft", () => {
    const next = patchDraft({ projectId: "p-2" });

    expect(next.projectId).toBe("p-2");
    expect(next).toEqual(readDraft());
  });

  it("keeps measured walls when a later step patches an unrelated field", () => {
    const walls = blankWalls().map((wall) => ({ ...wall, length: 3.2 }));
    patchDraft({ walls });
    patchDraft({ roomType: "bedroom" });

    expect(readDraft().walls).toHaveLength(4);
    expect(readDraft().walls.every((wall) => wall.length === 3.2)).toBe(true);
  });

  it("persists to sessionStorage so a refresh mid-wizard survives", () => {
    patchDraft({ projectId: "p-3", roomType: "living_room" });

    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)!);
    expect(stored.projectId).toBe("p-3");
    expect(stored.roomType).toBe("living_room");
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDraft(listener);

    patchDraft({ projectId: "p-4" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    patchDraft({ projectId: "p-5" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("clearDraft", () => {
  it("resets the draft to the empty state", () => {
    patchDraft({ projectId: "p-1", roomType: "kitchen", walls: blankWalls() });
    clearDraft();

    expect(readDraft()).toEqual({ projectId: null, roomType: null, walls: [] });
  });

  it("removes the sessionStorage key so a new tab starts clean", () => {
    patchDraft({ projectId: "p-1" });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    clearDraft();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDraft(listener);

    clearDraft();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("blankWalls", () => {
  it("pre-fills all four compass walls as unmeasured", () => {
    const walls = blankWalls();

    expect(walls.map((wall) => wall.id)).toEqual(["N", "E", "S", "W"]);
    expect(walls.every((wall) => Number.isNaN(wall.length))).toBe(true);
    expect(walls.every((wall) => wall.height === 2.6)).toBe(true);
  });

  it("gives each wall its own openings arrays", () => {
    const walls = blankWalls();
    walls[0].doors.push({ width: 0.9, height: 2.1, offsetFromLeft: 0.5 });

    expect(walls[1].doors).toHaveLength(0);
  });
});

describe("writeDraft", () => {
  it("survives sessionStorage being unavailable (private mode / quota)", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

    expect(() => writeDraft({ projectId: "p-9", roomType: null, walls: [] })).not.toThrow();
    // The in-memory cache still drives this tab.
    expect(readDraft().projectId).toBe("p-9");

    setItem.mockRestore();
  });
});

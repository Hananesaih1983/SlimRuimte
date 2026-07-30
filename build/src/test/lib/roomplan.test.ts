import { describe, expect, it } from "vitest";
import { parseCapturedRoom } from "@/lib/scan/roomplan";

/**
 * One Apple `CapturedRoom` surface. `simd_float4x4` serialises as 16
 * column-major floats: column 0 is the surface's local X axis in world space
 * (so it says which way the wall runs), column 3 the translation.
 */
function surface(options: {
  length: number;
  height?: number;
  cx: number;
  cz: number;
  alongX: boolean;
}) {
  const { length, height = 2.6, cx, cz, alongX } = options;
  const axis = alongX ? [1, 0, 0, 0] : [0, 0, 1, 0];

  return {
    dimensions: [length, height, 0.1],
    transform: [...axis, 0, 1, 0, 0, 0, 0, 1, 0, cx, 1.3, cz, 1],
  };
}

const NORTH = surface({ length: 4.2, cx: 0, cz: -1.7, alongX: true });
const EAST = surface({ length: 3.4, cx: 2.1, cz: 0, alongX: false });
const SOUTH = surface({ length: 4.2, cx: 0, cz: 1.7, alongX: true });
const WEST = surface({ length: 3.4, cx: -2.1, cz: 0, alongX: false });

function lengths(walls: ReturnType<typeof parseCapturedRoom>) {
  return Object.fromEntries(walls!.map((wall) => [wall.id, wall.length]));
}

describe("parseCapturedRoom", () => {
  it("maps a valid CapturedRoom onto four correctly measured walls", () => {
    const walls = parseCapturedRoom({ walls: [NORTH, EAST, SOUTH, WEST] });

    expect(walls).toHaveLength(4);
    expect(walls!.map((wall) => wall.id)).toEqual(["N", "E", "S", "W"]);
    expect(lengths(walls)).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
    expect(walls![0]).toMatchObject({ label: "Noord", height: 2.6 });
  });

  it("does not depend on the order the surfaces were captured in", () => {
    const walls = parseCapturedRoom({ walls: [WEST, SOUTH, EAST, NORTH] });

    expect(lengths(walls)).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
  });

  it("merges collinear segments into one wall run", () => {
    // RoomPlan routinely splits a long wall; the plan needs the run, not the sum.
    const walls = parseCapturedRoom({
      walls: [
        surface({ length: 2.1, cx: -1.05, cz: -1.7, alongX: true }),
        surface({ length: 2.1, cx: 1.05, cz: -1.7, alongX: true }),
        EAST,
        SOUTH,
        WEST,
      ],
    });

    expect(lengths(walls).N).toBe(4.2);
  });

  it("takes the outer extent of overlapping segments, not their sum", () => {
    const walls = parseCapturedRoom({
      walls: [
        surface({ length: 3.0, cx: -0.6, cz: -1.7, alongX: true }),
        surface({ length: 3.0, cx: 0.6, cz: -1.7, alongX: true }),
        EAST,
        SOUTH,
        WEST,
      ],
    });

    expect(lengths(walls).N).toBe(4.2);
  });

  it("takes the tallest segment's height, not the average", () => {
    // RoomPlan sometimes emits a low stub beside the full-height run.
    const walls = parseCapturedRoom({
      walls: [
        surface({ length: 4.2, height: 2.6, cx: 0, cz: -1.7, alongX: true }),
        surface({ length: 1.0, height: 0.9, cx: 0, cz: -1.7, alongX: true }),
        EAST,
        SOUTH,
        WEST,
      ],
    });

    expect(walls!.find((wall) => wall.id === "N")!.height).toBe(2.6);
  });

  it("mirrors a missing wall from its opposite", () => {
    const walls = parseCapturedRoom({ walls: [NORTH, EAST, SOUTH] });

    expect(walls).toHaveLength(4);
    expect(lengths(walls).W).toBe(3.4);
  });

  it("returns null when a whole opposing pair is missing", () => {
    // Documented deviation: the written plan expected a single wall segment to
    // mirror its opposite. It cannot — one wall leaves an entire axis unmeasured,
    // and inventing a width would persist a room nobody measured. A three-wall
    // scan (the test above) is the recoverable case; this one is rejected so the
    // user is sent back to re-scan.
    expect(parseCapturedRoom({ walls: [NORTH] })).toBeNull();
    expect(parseCapturedRoom({ walls: [NORTH, SOUTH] })).toBeNull();
  });

  it("returns null when there is no walls array", () => {
    expect(parseCapturedRoom({})).toBeNull();
    expect(parseCapturedRoom({ walls: null })).toBeNull();
    expect(parseCapturedRoom({ walls: "walls" })).toBeNull();
  });

  it("returns null for an empty walls array", () => {
    expect(parseCapturedRoom({ walls: [] })).toBeNull();
  });

  it("discards surfaces with no usable dimensions", () => {
    expect(
      parseCapturedRoom({
        walls: [{ dimensions: [0, 0, 0] }, { dimensions: "x" }, null, 42],
      }),
    ).toBeNull();
  });

  it("accepts a transform nested under `columns`", () => {
    const walls = parseCapturedRoom({
      walls: [NORTH, EAST, SOUTH, WEST].map((wall) => ({
        dimensions: wall.dimensions,
        transform: { columns: wall.transform },
      })),
    });

    expect(lengths(walls)).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
  });

  it("accepts a {x,y,z} dimensions object", () => {
    const walls = parseCapturedRoom({
      walls: [NORTH, EAST, SOUTH, WEST].map((wall) => ({
        dimensions: {
          x: wall.dimensions[0],
          y: wall.dimensions[1],
          z: wall.dimensions[2],
        },
        transform: wall.transform,
      })),
    });

    expect(lengths(walls)).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
  });

  it("falls back to alternating axes when a transform carries no rotation", () => {
    // Some exporters ship translation only; RoomPlan walks the room wall by
    // wall, so consecutive surfaces alternate axis.
    const walls = parseCapturedRoom({
      walls: [
        { dimensions: [4.2, 2.6, 0.1], transform: { translation: { x: 0, y: 1.3, z: -1.7 } } },
        { dimensions: [3.4, 2.6, 0.1], transform: { translation: { x: 2.1, y: 1.3, z: 0 } } },
        { dimensions: [4.2, 2.6, 0.1], transform: { translation: { x: 0, y: 1.3, z: 1.7 } } },
        { dimensions: [3.4, 2.6, 0.1], transform: { translation: { x: -2.1, y: 1.3, z: 0 } } },
      ],
    });

    expect(lengths(walls)).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
  });

  describe("openings", () => {
    const full = [NORTH, EAST, SOUTH, WEST];

    it("attaches a door to the wall whose plane it sits in", () => {
      const walls = parseCapturedRoom({
        walls: full,
        doors: [surface({ length: 0.9, height: 2.1, cx: 2.1, cz: 0.6, alongX: false })],
      });

      const east = walls!.find((wall) => wall.id === "E")!;
      expect(east.doors).toHaveLength(1);
      expect(walls!.reduce((n, wall) => n + wall.doors.length, 0)).toBe(1);
    });

    it("measures offsetFromLeft from the run's left end", () => {
      const walls = parseCapturedRoom({
        walls: full,
        // Centred on the north wall: a 1.2 m window on a 4.2 m run starts at 1.5.
        windows: [surface({ length: 1.2, height: 1.4, cx: 0, cz: -1.7, alongX: true })],
      });

      expect(walls!.find((wall) => wall.id === "N")!.windows[0]).toEqual({
        width: 1.2,
        height: 1.4,
        offsetFromLeft: 1.5,
      });
    });

    it("ignores an opening too far from any wall to belong to one", () => {
      const walls = parseCapturedRoom({
        walls: full,
        doors: [surface({ length: 0.9, height: 2.1, cx: 0, cz: 0, alongX: false })],
      });

      expect(walls!.reduce((n, wall) => n + wall.doors.length, 0)).toBe(0);
    });

    it("never attaches an opening to a mirrored (inferred) wall", () => {
      const walls = parseCapturedRoom({
        walls: [NORTH, EAST, SOUTH],
        doors: [surface({ length: 0.9, height: 2.1, cx: -2.1, cz: 0, alongX: false })],
      });

      expect(walls!.find((wall) => wall.id === "W")!.doors).toHaveLength(0);
    });

    it("clamps an opening so it always fits inside its wall", () => {
      // The same invariant the manual path is validated against, so a LiDAR room
      // can never fail the check a measured room has to pass.
      const walls = parseCapturedRoom({
        walls: full,
        doors: [surface({ length: 9, height: 2.1, cx: 0, cz: -1.7, alongX: true })],
      });

      const north = walls!.find((wall) => wall.id === "N")!;
      const door = north.doors[0];
      expect(door.width).toBeLessThanOrEqual(north.length);
      expect(door.offsetFromLeft + door.width).toBeLessThanOrEqual(north.length);
      expect(door.offsetFromLeft).toBeGreaterThanOrEqual(0);
    });

    it("produces a room that satisfies the manual path's own validator", async () => {
      const { roomCloses } = await import("@/lib/scan/geometry");
      const walls = parseCapturedRoom({
        walls: full,
        doors: [surface({ length: 0.9, height: 2.1, cx: 2.1, cz: 0.6, alongX: false })],
        windows: [surface({ length: 1.2, height: 1.4, cx: 0, cz: -1.7, alongX: true })],
      });

      expect(roomCloses(walls!)).toBe(true);
    });
  });
});

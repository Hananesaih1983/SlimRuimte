import { describe, expect, it } from "vitest";
import {
  MAX_WALL_LENGTH_M,
  computeFootprint,
  opposingWallsMatch,
  parseWall,
  roomCloses,
  roundCm,
  validateWalls,
} from "@/lib/scan/geometry";
import type { Wall } from "@/lib/scan/types";

function wall(id: Wall["id"], length: number, extra: Partial<Wall> = {}): Wall {
  return { id, label: id, length, height: 2.6, doors: [], windows: [], ...extra };
}

/** The canonical 4.20 x 3.40 m room used throughout the brief. */
function room(overrides: Partial<Record<Wall["id"], Partial<Wall>>> = {}): Wall[] {
  return [
    { ...wall("N", 4.2), ...overrides.N },
    { ...wall("E", 3.4), ...overrides.E },
    { ...wall("S", 4.2), ...overrides.S },
    { ...wall("W", 3.4), ...overrides.W },
  ];
}

describe("computeFootprint", () => {
  it("computes area as 4.20 * 3.40 = 14.28", () => {
    expect(computeFootprint(room()).area).toBe(14.28);
  });

  it("computes perimeter as 2 * (4.20 + 3.40) = 15.20", () => {
    expect(computeFootprint(room()).perimeter).toBe(15.2);
  });

  it("averages each opposing pair into one dimension", () => {
    // 4.20 and 4.24 average to 4.22, halving the error rather than picking one.
    const footprint = computeFootprint(room({ S: { length: 4.24 } }));

    expect(footprint.width).toBe(4.22);
    expect(footprint.depth).toBe(3.4);
  });

  it("treats an unmeasured wall as 0 instead of poisoning every number with NaN", () => {
    const footprint = computeFootprint(room({ S: { length: Number.NaN } }));

    expect(footprint.width).toBe(2.1);
    expect(Number.isNaN(footprint.area)).toBe(false);
  });

  it("prefers an explicit height over the per-wall average", () => {
    expect(computeFootprint(room(), 3.1).height).toBe(3.1);
  });

  it("averages the wall heights when none is given", () => {
    const footprint = computeFootprint(room({ N: { height: 2.8 } }));

    expect(footprint.height).toBe(2.65);
  });

  it("falls back to the 2.60 m default when no height is measurable", () => {
    const heightless = room().map((w) => ({ ...w, height: Number.NaN }));

    expect(computeFootprint(heightless).height).toBe(2.6);
  });

  it("returns zeroes rather than NaN for an empty wall set", () => {
    expect(computeFootprint([])).toMatchObject({ width: 0, depth: 0, area: 0 });
  });
});

describe("roundCm", () => {
  it("rounds to centimetre precision", () => {
    expect(roundCm(4.2049)).toBe(4.2);
    expect(roundCm(4.205)).toBe(4.21);
  });

  it("keeps a whole number whole", () => {
    expect(roundCm(4)).toBe(4);
  });
});

describe("opposingWallsMatch", () => {
  it("accepts a 2 cm difference (|4.20 - 4.22| = 0.02 < 0.05)", () => {
    expect(opposingWallsMatch(4.2, 4.22)).toBe(true);
  });

  it("rejects a 60 cm difference (|4.20 - 4.80| = 0.60 > 0.05)", () => {
    expect(opposingWallsMatch(4.2, 4.8)).toBe(false);
  });

  it("accepts exactly 5 cm, the stated tolerance", () => {
    expect(opposingWallsMatch(4.2, 4.25)).toBe(true);
  });

  it("rejects just past the tolerance", () => {
    expect(opposingWallsMatch(4.2, 4.26)).toBe(false);
  });

  it("is not defeated by floating-point representation", () => {
    // 4.25 - 4.20 is 0.050000000000000266 in IEEE-754; a naive `<=` fails here.
    expect(opposingWallsMatch(4.25, 4.2)).toBe(true);
  });

  it("treats a not-yet-measured wall as not-yet-failing", () => {
    expect(opposingWallsMatch(4.2, undefined)).toBe(true);
    expect(opposingWallsMatch(Number.NaN, 4.2)).toBe(true);
  });
});

describe("validateWalls", () => {
  it("passes a rectangle that closes within tolerance", () => {
    expect(validateWalls(room())).toHaveLength(0);
    expect(roomCloses(room())).toBe(true);
  });

  it("flags opposing walls that disagree by more than 5 cm", () => {
    const issues = validateWalls(room({ S: { length: 4.8 } }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ wallId: "N", severity: "error" });
    expect(roomCloses(room({ S: { length: 4.8 } }))).toBe(false);
  });

  it("reports every missing wall rather than stopping at the first", () => {
    const issues = validateWalls([wall("N", 4.2)]);

    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(3);
    expect(issues.map((issue) => issue.wallId)).toEqual(["E", "S", "W"]);
  });

  it.each([
    [0, "zero"],
    [-4.2, "negative"],
    [0.2, "below the 0.5 m minimum"],
    [MAX_WALL_LENGTH_M + 0.01, "above the 50 m maximum"],
    [Number.NaN, "unmeasured"],
  ])("rejects a wall length of %j (%s)", (length) => {
    const issues = validateWalls(room({ N: { length } }));

    expect(issues.some((issue) => issue.wallId === "N" && issue.severity === "error"))
      .toBe(true);
  });

  it.each([
    [0, "zero"],
    [1.2, "below the 1.5 m minimum"],
    [10.5, "above the 10 m maximum"],
  ])("rejects a wall height of %j (%s)", (height) => {
    expect(validateWalls(room({ N: { height } }))).not.toHaveLength(0);
  });

  it("rejects an opening that runs off the end of its wall", () => {
    const issues = validateWalls(
      room({ N: { doors: [{ width: 1.2, height: 2.1, offsetFromLeft: 3.6 }] } }),
    );

    expect(issues[0].message).toContain("buiten de muur");
  });

  it("accepts an opening that ends exactly at the wall's end", () => {
    expect(
      validateWalls(
        room({ N: { doors: [{ width: 1.2, height: 2.1, offsetFromLeft: 3.0 }] } }),
      ),
    ).toHaveLength(0);
  });

  it("rejects an opening taller than its wall", () => {
    const issues = validateWalls(
      room({ N: { windows: [{ width: 1.2, height: 3.0, offsetFromLeft: 0.5 }] } }),
    );

    expect(issues[0].message).toContain("hoger dan de muur");
  });

  it("rejects an opening at a negative offset", () => {
    expect(
      validateWalls(
        room({ N: { doors: [{ width: 0.9, height: 2.1, offsetFromLeft: -1 }] } }),
      ),
    ).not.toHaveLength(0);
  });
});

describe("parseWall", () => {
  it("normalises a well-formed wall and rounds to centimetres", () => {
    expect(parseWall({ id: "N", length: 4.2049, height: 2.6, doors: [], windows: [] }))
      .toMatchObject({ id: "N", label: "Noord", length: 4.2, height: 2.6 });
  });

  it("accepts a numeric string, which is what a form posts", () => {
    expect(parseWall({ id: "N", length: "4.20", height: "2.60" })).toMatchObject({
      length: 4.2,
      height: 2.6,
    });
  });

  const badLengths: Array<[unknown, string]> = [
    [null, "null"],
    [undefined, "undefined"],
    [true, "boolean"],
    [[], "empty array"],
    [[4.2], "array"],
    ["", "empty string"],
    ["   ", "whitespace"],
    ["DROP TABLE projects", "sql injection string"],
    [{}, "object"],
    [Number.NaN, "NaN"],
    [Infinity, "Infinity"],
  ];

  it.each(badLengths)("rejects a length of %j (%s)", (length, label) => {
    // Bare Number() would turn null, "" and [] into 0 and true into 1, letting a
    // hand-rolled POST smuggle a fabricated wall past the parser.
    expect(parseWall({ id: "N", length, height: 2.6 }), label).toBeNull();
  });

  it("rejects an unknown wall id", () => {
    expect(parseWall({ id: "NE", length: 4.2, height: 2.6 })).toBeNull();
    expect(parseWall({ id: 0, length: 4.2, height: 2.6 })).toBeNull();
  });

  it("rejects a non-object", () => {
    expect(parseWall(null)).toBeNull();
    expect(parseWall("N")).toBeNull();
  });

  it("supplies the Dutch label when the input omits it", () => {
    expect(parseWall({ id: "W", length: 3.4, height: 2.6 })!.label).toBe("West");
  });

  it("defaults missing openings to empty arrays", () => {
    expect(parseWall({ id: "N", length: 4.2, height: 2.6 })).toMatchObject({
      doors: [],
      windows: [],
    });
  });

  it("drops malformed openings instead of inventing dimensions for them", () => {
    const parsed = parseWall({
      id: "N",
      length: 4.2,
      height: 2.6,
      doors: [
        { width: true, height: true, offsetFromLeft: 0 },
        { width: 0.9, height: 2.1, offsetFromLeft: 0.5 },
        "not an opening",
      ],
    });

    expect(parsed!.doors).toEqual([{ width: 0.9, height: 2.1, offsetFromLeft: 0.5 }]);
  });
});

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import { WALL_LABELS, type Opening, type Wall, type WallId } from "@/lib/scan/types";

/**
 * The diagram is pure SVG with no text nodes worth querying by role, so these
 * assertions read the rendered geometry directly. That is deliberate: the
 * component's whole job is where the strokes land, and a smoke test that only
 * checked "it rendered" would pass with the walls drawn on top of each other.
 */

const HIGHLIGHT = "#3B82F6";
const WALL = "#E5E7EB";
const WINDOW = "#60A5FA";

function wall(id: WallId, length: number, extra: Partial<Wall> = {}): Wall {
  return {
    id,
    label: WALL_LABELS[id],
    length,
    height: 2.6,
    doors: [],
    windows: [],
    ...extra,
  };
}

/** A 4.20 x 3.40 m room that closes. */
function fourWalls(overrides: Partial<Record<WallId, Partial<Wall>>> = {}): Wall[] {
  return [
    wall("N", 4.2, overrides.N),
    wall("E", 3.4, overrides.E),
    wall("S", 4.2, overrides.S),
    wall("W", 3.4, overrides.W),
  ];
}

function door(offsetFromLeft: number, width = 0.9): Opening {
  return { width, height: 2.1, offsetFromLeft };
}

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no <svg> rendered");
  return svg as SVGSVGElement;
}

function strokesOf(container: HTMLElement, color: string): Element[] {
  return Array.from(svgOf(container).querySelectorAll(`[stroke="${color}"]`));
}

describe("RoomDiagramSVG", () => {
  it("renders four walls without crashing", () => {
    const { container } = render(<RoomDiagramSVG walls={fourWalls()} />);

    expect(svgOf(container)).toBeInTheDocument();
    // One line per wall when no doors cut a gap in any of them.
    expect(strokesOf(container, WALL)).toHaveLength(4);
  });

  it("labels each wall with its measured length", () => {
    const { container } = render(<RoomDiagramSVG walls={fourWalls()} />);
    const labels = Array.from(svgOf(container).querySelectorAll("text")).map(
      (node) => node.textContent,
    );

    expect(labels).toContain("Noord 4.20 m");
    expect(labels).toContain("Oost 3.40 m");
  });

  it("exposes the room size to screen readers", () => {
    const { container } = render(<RoomDiagramSVG walls={fourWalls()} />);

    expect(svgOf(container).getAttribute("aria-label")).toBe(
      "Plattegrond 4.20 bij 3.40 meter met 0 deuren en ramen",
    );
  });

  describe("highlighting", () => {
    it("draws the highlighted wall in blue", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls()} highlightedWall="N" />,
      );

      expect(strokesOf(container, HIGHLIGHT).length).toBeGreaterThan(0);
    });

    it("leaves the other three walls unhighlighted", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls()} highlightedWall="N" />,
      );

      expect(strokesOf(container, HIGHLIGHT)).toHaveLength(1);
      expect(strokesOf(container, WALL)).toHaveLength(3);
    });

    it("uses no highlight colour at all when nothing is highlighted", () => {
      const { container } = render(<RoomDiagramSVG walls={fourWalls()} />);

      expect(strokesOf(container, HIGHLIGHT)).toHaveLength(0);
      expect(
        svgOf(container).querySelectorAll(`text[fill="${HIGHLIGHT}"]`),
      ).toHaveLength(0);
    });

    it("bolds the highlighted wall's label", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls()} highlightedWall="E" />,
      );
      const bold = Array.from(svgOf(container).querySelectorAll("text")).filter(
        (node) => node.getAttribute("font-weight") === "600",
      );

      expect(bold).toHaveLength(1);
      expect(bold[0].textContent).toContain("Oost");
    });

    it("highlights the right wall when asked for each one in turn", () => {
      for (const id of ["N", "E", "S", "W"] as const) {
        const { container, unmount } = render(
          <RoomDiagramSVG walls={fourWalls()} highlightedWall={id} />,
        );

        const bold = Array.from(svgOf(container).querySelectorAll("text")).find(
          (node) => node.getAttribute("font-weight") === "600",
        );
        expect(bold?.textContent).toContain(WALL_LABELS[id]);
        unmount();
      }
    });
  });

  describe("degenerate input", () => {
    it("renders an empty walls array without crashing", () => {
      const { container } = render(<RoomDiagramSVG walls={[]} />);

      // Falls back to a 4 x 3 m outline so the wizard has something to show
      // before the first measurement is typed.
      expect(svgOf(container)).toBeInTheDocument();
      expect(strokesOf(container, WALL)).toHaveLength(4);
      expect(svgOf(container).getAttribute("aria-label")).toBe(
        "Plattegrond 4.00 bij 3.00 meter met 0 deuren en ramen",
      );
    });

    it("renders a partially measured room using the fallback for the missing axis", () => {
      const { container } = render(<RoomDiagramSVG walls={[wall("N", 5)]} />);

      expect(svgOf(container).getAttribute("aria-label")).toBe(
        "Plattegrond 5.00 bij 3.00 meter met 0 deuren en ramen",
      );
    });

    it("does not crash on NaN lengths, which is what a blank wizard field holds", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { length: Number.NaN } })} />,
      );

      expect(svgOf(container)).toBeInTheDocument();
      // Falls through to the opposing wall rather than producing NaN geometry.
      expect(
        Array.from(svgOf(container).querySelectorAll("line")).every(
          (line) => !Number.isNaN(Number(line.getAttribute("x1"))),
        ),
      ).toBe(true);
    });

    it("does not crash on a zero-length wall", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { length: 0 }, S: { length: 0 } })} />,
      );

      expect(svgOf(container)).toBeInTheDocument();
    });
  });

  describe("doors", () => {
    it("cuts the wall into two runs, leaving a gap where the door sits", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { doors: [door(1.5)] } })} />,
      );

      // N is now two segments; E, S and W are one each.
      expect(strokesOf(container, WALL)).toHaveLength(5);
    });

    it("draws a dashed swing arc so the gap reads as a door", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { doors: [door(1.5)] } })} />,
      );
      const arcs = svgOf(container).querySelectorAll("path[stroke-dasharray]");

      expect(arcs).toHaveLength(1);
      expect(arcs[0].getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ L /);
    });

    it("merges overlapping doors into one gap rather than drawing it twice", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { doors: [door(1.0), door(1.4)] } })} />,
      );

      // Still one gap => two runs on N, plus the other three walls.
      expect(strokesOf(container, WALL)).toHaveLength(5);
    });

    it("drops a door positioned entirely off the end of its wall", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { doors: [door(99)] } })} />,
      );

      expect(strokesOf(container, WALL)).toHaveLength(4);
      expect(svgOf(container).querySelectorAll("path[stroke-dasharray]")).toHaveLength(0);
    });

    it("honours the doors prop override ahead of the wall's own openings", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ N: { doors: [door(1.5)] } })} doors={{ N: [] }} />,
      );

      expect(strokesOf(container, WALL)).toHaveLength(4);
    });
  });

  describe("windows", () => {
    it("draws a window as two parallel lines, the standard plan symbol", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ S: { windows: [door(1.2, 1.4)] } })} />,
      );

      expect(strokesOf(container, WINDOW)).toHaveLength(2);
    });

    it("does not cut a gap in the wall for a window", () => {
      const { container } = render(
        <RoomDiagramSVG walls={fourWalls({ S: { windows: [door(1.2, 1.4)] } })} />,
      );

      // Unlike a door, the wall behind a window stays continuous.
      expect(strokesOf(container, WALL)).toHaveLength(4);
    });

    it("draws one pair per window", () => {
      const { container } = render(
        <RoomDiagramSVG
          walls={fourWalls({ S: { windows: [door(0.4, 0.8), door(2.4, 0.8)] } })}
        />,
      );

      expect(strokesOf(container, WINDOW)).toHaveLength(4);
    });

    it("drops a window with non-finite dimensions instead of drawing NaN", () => {
      const { container } = render(
        <RoomDiagramSVG
          walls={fourWalls({
            S: { windows: [{ width: Number.NaN, height: 1.2, offsetFromLeft: 1 }] },
          })}
        />,
      );

      expect(strokesOf(container, WINDOW)).toHaveLength(0);
    });

    it("counts doors and windows together in the accessible description", () => {
      const { container } = render(
        <RoomDiagramSVG
          walls={fourWalls({
            N: { doors: [door(1.5)] },
            S: { windows: [door(1.2, 1.4)] },
          })}
        />,
      );

      expect(svgOf(container).getAttribute("aria-label")).toContain("met 2 deuren en ramen");
    });
  });
});

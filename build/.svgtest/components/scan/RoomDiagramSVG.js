"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomDiagramSVG = RoomDiagramSVG;
const jsx_runtime_1 = require("react/jsx-runtime");
const types_1 = require("@/lib/scan/types");
const geometry_1 = require("@/lib/scan/geometry");
/**
 * Top-down floor plan of a rectangular room.
 *
 * Pure and server-renderable — no hooks, no client boundary — so the wizard, the
 * review screen and the project detail page all render it the same way.
 *
 * Openings are positioned by `offsetFromLeft`, measured along the wall in the
 * direction this component draws it: N and S run left-to-right, E and W run
 * top-to-bottom (see `Opening` in `src/lib/scan/types.ts`).
 */
const HIGHLIGHT_COLOR = "#3B82F6";
const WALL_COLOR = "#E5E7EB";
const LABEL_COLOR = "#6B7280";
const WINDOW_COLOR = "#60A5FA";
const FLOOR_COLOR = "#F9FAFB";
const WALL_STROKE = 8;
const PADDING = 44;
const CANVAS = 340;
/** Fallbacks keep the diagram legible while the wizard still has empty inputs. */
const FALLBACK_WIDTH_M = 4;
const FALLBACK_DEPTH_M = 3;
function RoomDiagramSVG({ walls, highlightedWall = null, doors, windows, className, }) {
    const byId = new Map(walls.map((wall) => [wall.id, wall]));
    const lengthOf = (id) => {
        const value = byId.get(id)?.length;
        return (0, geometry_1.isFiniteNumber)(value) && value > 0 ? value : null;
    };
    // Each axis uses whichever of its two walls has been measured, so a partially
    // filled wizard still draws a sensibly proportioned room.
    const widthM = lengthOf("N") ?? lengthOf("S") ?? FALLBACK_WIDTH_M;
    const depthM = lengthOf("E") ?? lengthOf("W") ?? FALLBACK_DEPTH_M;
    const usable = CANVAS - PADDING * 2;
    const scale = Math.min(usable / widthM, usable / depthM);
    const drawnWidth = widthM * scale;
    const drawnDepth = depthM * scale;
    const geometry = {
        x0: (CANVAS - drawnWidth) / 2,
        y0: (CANVAS - drawnDepth) / 2,
        x1: (CANVAS - drawnWidth) / 2 + drawnWidth,
        y1: (CANVAS - drawnDepth) / 2 + drawnDepth,
        scale,
    };
    return ((0, jsx_runtime_1.jsxs)("svg", { viewBox: `0 0 ${CANVAS} ${CANVAS}`, className: className, role: "img", "aria-label": describeRoom(walls, widthM, depthM), children: [(0, jsx_runtime_1.jsx)("rect", { x: geometry.x0, y: geometry.y0, width: drawnWidth, height: drawnDepth, fill: FLOOR_COLOR }), ["N", "E", "S", "W"].map((id) => ((0, jsx_runtime_1.jsx)(WallShape, { id: id, wall: byId.get(id), geometry: geometry, highlighted: highlightedWall === id, doors: doors?.[id] ?? byId.get(id)?.doors ?? [], windows: windows?.[id] ?? byId.get(id)?.windows ?? [] }, id)))] }));
}
function WallShape({ id, wall, geometry, highlighted, doors, windows, }) {
    const line = wallLine(id, geometry);
    const color = highlighted ? HIGHLIGHT_COLOR : WALL_COLOR;
    // Length actually drawn, in metres — the on-screen run, which may differ
    // slightly from the measured value when opposing walls disagree.
    const drawnLengthM = line.lengthPx / geometry.scale;
    const measured = wall?.length;
    return ((0, jsx_runtime_1.jsxs)("g", { children: [solidSpans(doors, drawnLengthM).map(([from, to], index) => {
                const start = line.pointAt(from);
                const end = line.pointAt(to);
                return ((0, jsx_runtime_1.jsx)("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, stroke: color, strokeWidth: WALL_STROKE, strokeLinecap: "butt" }, `wall-${id}-${index}`));
            }), windows.map((window, index) => ((0, jsx_runtime_1.jsx)(WindowMark, { opening: window, line: line, maxLengthM: drawnLengthM }, `window-${id}-${index}`))), doors.map((door, index) => ((0, jsx_runtime_1.jsx)(DoorMark, { opening: door, line: line, maxLengthM: drawnLengthM }, `door-${id}-${index}`))), (0, jsx_runtime_1.jsx)(WallLabel, { line: line, highlighted: highlighted, text: (0, geometry_1.isFiniteNumber)(measured) && measured > 0
                    ? `${types_1.WALL_LABELS[id]} ${measured.toFixed(2)} m`
                    : types_1.WALL_LABELS[id] })] }));
}
/** Two thin parallel lines straddling the wall — the standard plan symbol. */
function WindowMark({ opening, line, maxLengthM, }) {
    const span = clampSpan(opening, maxLengthM);
    if (!span)
        return null;
    const [from, to] = span;
    const offset = WALL_STROKE / 2 - 1;
    return ((0, jsx_runtime_1.jsx)("g", { children: [-offset, offset].map((delta, index) => {
            const start = line.pointAt(from, delta);
            const end = line.pointAt(to, delta);
            return ((0, jsx_runtime_1.jsx)("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, stroke: WINDOW_COLOR, strokeWidth: 1.5 }, index));
        }) }));
}
/**
 * Doors are already a gap in the wall (see `solidSpans`); this adds the swing
 * arc so the opening reads as a door rather than a missing wall.
 */
function DoorMark({ opening, line, maxLengthM, }) {
    const span = clampSpan(opening, maxLengthM);
    if (!span)
        return null;
    const [from, to] = span;
    const hinge = line.pointAt(from);
    const radius = (to - from) * line.scale;
    const swingEnd = line.pointAt(from, -radius);
    return ((0, jsx_runtime_1.jsx)("path", { d: `M ${hinge.x} ${hinge.y} L ${line.pointAt(to).x} ${line.pointAt(to).y} M ${line.pointAt(to).x} ${line.pointAt(to).y} A ${radius} ${radius} 0 0 1 ${swingEnd.x} ${swingEnd.y}`, fill: "none", stroke: LABEL_COLOR, strokeWidth: 1.25, strokeDasharray: "3 2" }));
}
function WallLabel({ line, text, highlighted, }) {
    const anchor = line.pointAt(line.lengthPx / line.scale / 2, 20);
    return ((0, jsx_runtime_1.jsx)("text", { x: anchor.x, y: anchor.y, textAnchor: "middle", dominantBaseline: "middle", fontSize: 11, fontWeight: highlighted ? 600 : 400, fill: highlighted ? HIGHLIGHT_COLOR : LABEL_COLOR, children: text }));
}
function wallLine(id, geometry) {
    const { x0, y0, x1, y1, scale } = geometry;
    switch (id) {
        case "N":
            return {
                lengthPx: x1 - x0,
                scale,
                pointAt: (m, outward = 0) => ({ x: x0 + m * scale, y: y0 - outward }),
            };
        case "S":
            return {
                lengthPx: x1 - x0,
                scale,
                pointAt: (m, outward = 0) => ({ x: x0 + m * scale, y: y1 + outward }),
            };
        case "E":
            return {
                lengthPx: y1 - y0,
                scale,
                pointAt: (m, outward = 0) => ({ x: x1 + outward, y: y0 + m * scale }),
            };
        case "W":
            return {
                lengthPx: y1 - y0,
                scale,
                pointAt: (m, outward = 0) => ({ x: x0 - outward, y: y0 + m * scale }),
            };
    }
}
/** Clamps an opening to the drawn wall run, or drops it if it falls outside. */
function clampSpan(opening, maxLengthM) {
    if (!(0, geometry_1.isFiniteNumber)(opening.offsetFromLeft) || !(0, geometry_1.isFiniteNumber)(opening.width)) {
        return null;
    }
    const from = Math.max(0, Math.min(opening.offsetFromLeft, maxLengthM));
    const to = Math.max(from, Math.min(opening.offsetFromLeft + opening.width, maxLengthM));
    return to - from > 0.001 ? [from, to] : null;
}
/**
 * The wall runs that remain once doors are cut out of it, as [from, to] pairs
 * in metres. Overlapping doors are merged so a shared gap is not drawn twice.
 */
function solidSpans(doors, wallLengthM) {
    const gaps = doors
        .map((door) => clampSpan(door, wallLengthM))
        .filter((span) => span !== null)
        .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [from, to] of gaps) {
        const last = merged[merged.length - 1];
        if (last && from <= last[1]) {
            last[1] = Math.max(last[1], to);
        }
        else {
            merged.push([from, to]);
        }
    }
    const spans = [];
    let cursor = 0;
    for (const [from, to] of merged) {
        if (from > cursor)
            spans.push([cursor, from]);
        cursor = Math.max(cursor, to);
    }
    if (cursor < wallLengthM)
        spans.push([cursor, wallLengthM]);
    return spans;
}
function describeRoom(walls, widthM, depthM) {
    const openings = walls.reduce((total, wall) => total + wall.doors.length + wall.windows.length, 0);
    return `Plattegrond ${widthM.toFixed(2)} bij ${depthM.toFixed(2)} meter met ${openings} deuren en ramen`;
}

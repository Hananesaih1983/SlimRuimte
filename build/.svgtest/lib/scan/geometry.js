"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPPOSING_WALL_ERROR = exports.DEFAULT_WALL_HEIGHT_M = exports.MAX_WALL_HEIGHT_M = exports.MIN_WALL_HEIGHT_M = exports.MAX_WALL_LENGTH_M = exports.MIN_WALL_LENGTH_M = exports.WALL_MATCH_TOLERANCE_M = void 0;
exports.roundCm = roundCm;
exports.isFiniteNumber = isFiniteNumber;
exports.opposingWallsMatch = opposingWallsMatch;
exports.computeFootprint = computeFootprint;
exports.validateWalls = validateWalls;
exports.roomCloses = roomCloses;
exports.parseWall = parseWall;
const types_1 = require("./types");
/**
 * Geometry + validation for the scan flow.
 *
 * Deliberately dependency-free and pure so the exact same rules run in the
 * browser (live feedback in the wizard) and on the server (the check that
 * actually gates the write). The client copy is a convenience; the server call
 * in /api/scan/manual-save is the one that counts.
 */
/** A rectangular room only closes if each opposing pair agrees within 5 cm. */
exports.WALL_MATCH_TOLERANCE_M = 0.05;
/** Input bounds for a single wall run, matching the wizard's number inputs. */
exports.MIN_WALL_LENGTH_M = 0.5;
exports.MAX_WALL_LENGTH_M = 50;
exports.MIN_WALL_HEIGHT_M = 1.5;
exports.MAX_WALL_HEIGHT_M = 10;
exports.DEFAULT_WALL_HEIGHT_M = 2.6;
exports.OPPOSING_WALL_ERROR = "De tegenoverliggende muren verschillen meer dan 5cm. Controleer je meting.";
/** Rounds to centimetre precision — the finest unit any scan path can resolve. */
function roundCm(value) {
    return Math.round(value * 100) / 100;
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
/**
 * True when both members of an opposing pair are present and agree within
 * tolerance. Missing walls are "not yet failing" so the wizard can validate
 * incrementally as the user fills walls in.
 */
function opposingWallsMatch(a, b) {
    if (!isFiniteNumber(a) || !isFiniteNumber(b))
        return true;
    return Math.abs(a - b) <= exports.WALL_MATCH_TOLERANCE_M + 1e-9;
}
/**
 * Averages each opposing pair into a single width/depth.
 *
 * Averaging rather than picking one wall halves the error when the two
 * measurements disagree slightly — and they always disagree slightly, because
 * real walls are not perfectly parallel.
 */
function computeFootprint(walls, height) {
    const byId = new Map(walls.map((wall) => [wall.id, wall]));
    const lengthOf = (id) => byId.get(id)?.length ?? 0;
    const width = roundCm((lengthOf("N") + lengthOf("S")) / 2);
    const depth = roundCm((lengthOf("E") + lengthOf("W")) / 2);
    const heights = walls.map((wall) => wall.height).filter(isFiniteNumber);
    const resolvedHeight = isFiniteNumber(height)
        ? roundCm(height)
        : heights.length > 0
            ? roundCm(heights.reduce((sum, h) => sum + h, 0) / heights.length)
            : exports.DEFAULT_WALL_HEIGHT_M;
    return {
        width,
        depth,
        height: resolvedHeight,
        area: roundCm(width * depth),
        perimeter: roundCm(2 * (width + depth)),
    };
}
/**
 * Full server-side validation of a wall set.
 *
 * Returns every problem rather than throwing on the first, so the review screen
 * can show a complete checklist instead of making the user resubmit repeatedly.
 */
function validateWalls(walls) {
    const issues = [];
    const byId = new Map(walls.map((wall) => [wall.id, wall]));
    for (const id of types_1.WALL_IDS) {
        const wall = byId.get(id);
        if (!wall) {
            issues.push({
                wallId: id,
                message: `Muur ${types_1.WALL_LABELS[id]} ontbreekt.`,
                severity: "error",
            });
            continue;
        }
        if (!isFiniteNumber(wall.length) ||
            wall.length < exports.MIN_WALL_LENGTH_M ||
            wall.length > exports.MAX_WALL_LENGTH_M) {
            issues.push({
                wallId: id,
                message: `Lengte van muur ${types_1.WALL_LABELS[id]} moet tussen ${exports.MIN_WALL_LENGTH_M} en ${exports.MAX_WALL_LENGTH_M} meter liggen.`,
                severity: "error",
            });
        }
        if (!isFiniteNumber(wall.height) ||
            wall.height < exports.MIN_WALL_HEIGHT_M ||
            wall.height > exports.MAX_WALL_HEIGHT_M) {
            issues.push({
                wallId: id,
                message: `Hoogte van muur ${types_1.WALL_LABELS[id]} moet tussen ${exports.MIN_WALL_HEIGHT_M} en ${exports.MAX_WALL_HEIGHT_M} meter liggen.`,
                severity: "error",
            });
        }
        issues.push(...validateOpenings(wall));
    }
    for (const [a, b] of types_1.OPPOSING_WALLS) {
        const wallA = byId.get(a);
        const wallB = byId.get(b);
        if (!wallA || !wallB)
            continue;
        if (!opposingWallsMatch(wallA.length, wallB.length)) {
            issues.push({ wallId: a, message: exports.OPPOSING_WALL_ERROR, severity: "error" });
        }
    }
    return issues;
}
/**
 * An opening must fit inside the wall that holds it — a 1.2 m window 4 m along a
 * 4.2 m wall would otherwise produce a floor plan that cannot be built.
 */
function validateOpenings(wall) {
    const issues = [];
    const groups = [
        ["Deur", wall.doors],
        ["Raam", wall.windows],
    ];
    for (const [noun, openings] of groups) {
        for (const opening of openings) {
            if (!isFiniteNumber(opening.width) ||
                !isFiniteNumber(opening.height) ||
                !isFiniteNumber(opening.offsetFromLeft) ||
                opening.width <= 0 ||
                opening.height <= 0 ||
                opening.offsetFromLeft < 0) {
                issues.push({
                    wallId: wall.id,
                    message: `${noun} in muur ${types_1.WALL_LABELS[wall.id]} heeft ongeldige maten.`,
                    severity: "error",
                });
                continue;
            }
            if (isFiniteNumber(wall.length) &&
                opening.offsetFromLeft + opening.width > wall.length + 1e-9) {
                issues.push({
                    wallId: wall.id,
                    message: `${noun} in muur ${types_1.WALL_LABELS[wall.id]} valt buiten de muur (${roundCm(opening.offsetFromLeft + opening.width).toFixed(2)} m op een muur van ${wall.length.toFixed(2)} m).`,
                    severity: "error",
                });
            }
            if (isFiniteNumber(wall.height) && opening.height > wall.height + 1e-9) {
                issues.push({
                    wallId: wall.id,
                    message: `${noun} in muur ${types_1.WALL_LABELS[wall.id]} is hoger dan de muur.`,
                    severity: "error",
                });
            }
        }
    }
    return issues;
}
/** Convenience wrapper: does this wall set close into a usable rectangle? */
function roomCloses(walls) {
    return validateWalls(walls).every((issue) => issue.severity !== "error");
}
/** Normalises unknown JSON into a `Wall`, dropping anything malformed. */
function parseWall(input) {
    if (typeof input !== "object" || input === null)
        return null;
    const raw = input;
    const id = raw.id;
    if (!(typeof id === "string" && types_1.WALL_IDS.includes(id))) {
        return null;
    }
    const wallId = id;
    const length = Number(raw.length);
    const height = Number(raw.height);
    if (!Number.isFinite(length) || !Number.isFinite(height))
        return null;
    return {
        id: wallId,
        label: typeof raw.label === "string" ? raw.label : types_1.WALL_LABELS[wallId],
        length: roundCm(length),
        height: roundCm(height),
        doors: parseOpenings(raw.doors),
        windows: parseOpenings(raw.windows),
    };
}
function parseOpenings(input) {
    if (!Array.isArray(input))
        return [];
    return input.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null)
            return [];
        const raw = entry;
        const width = Number(raw.width);
        const height = Number(raw.height);
        const offsetFromLeft = Number(raw.offsetFromLeft);
        if (!Number.isFinite(width) ||
            !Number.isFinite(height) ||
            !Number.isFinite(offsetFromLeft)) {
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

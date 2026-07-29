"use strict";
/**
 * Shared vocabulary for the scan flow (LiDAR import + manual measurement).
 *
 * The shape defined here is what lands in `public.projects.room_dimensions`
 * (JSONB), so both paths converge on one structure — everything downstream
 * (floor plan SVG/PDF/DXF, GLB, render prompts) reads this and never needs to
 * know whether the numbers came from magicplan or from a tape measure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_TYPES = exports.OPPOSING_WALLS = exports.WALL_LABELS = exports.WALL_IDS = void 0;
exports.isRoomTypeId = isRoomTypeId;
exports.isWallId = isWallId;
/** Compass ids, ordered the way the wizard walks them and the SVG draws them. */
exports.WALL_IDS = ["N", "E", "S", "W"];
exports.WALL_LABELS = {
    N: "Noord",
    E: "Oost",
    S: "Zuid",
    W: "West",
};
/** Opposing pairs. Both members must agree within `WALL_MATCH_TOLERANCE_M`. */
exports.OPPOSING_WALLS = [
    ["N", "S"],
    ["E", "W"],
];
/**
 * Room types offered in manual step 1, mapped onto the `renovation_type` CHECK
 * constraint in `projects` (001_init.sql) so the wizard can set it on save.
 */
exports.ROOM_TYPES = [
    { id: "kitchen", label: "Keuken", icon: "🍳" },
    { id: "bathroom", label: "Badkamer", icon: "🚿" },
    { id: "living_room", label: "Woonkamer", icon: "🛋️" },
    { id: "bedroom", label: "Slaapkamer", icon: "🛏️" },
    { id: "open_plan", label: "Open plattegrond", icon: "🏗️" },
    { id: "extension", label: "Aanbouw", icon: "🏠" },
];
function isRoomTypeId(value) {
    return (typeof value === "string" &&
        exports.ROOM_TYPES.some((roomType) => roomType.id === value));
}
function isWallId(value) {
    return typeof value === "string" && exports.WALL_IDS.includes(value);
}

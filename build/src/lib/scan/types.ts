/**
 * Shared vocabulary for the scan flow (LiDAR import + manual measurement).
 *
 * The shape defined here is what lands in `public.projects.room_dimensions`
 * (JSONB), so both paths converge on one structure — everything downstream
 * (floor plan SVG/PDF/DXF, GLB, render prompts) reads this and never needs to
 * know whether the numbers came from magicplan or from a tape measure.
 */

/** Compass ids, ordered the way the wizard walks them and the SVG draws them. */
export const WALL_IDS = ["N", "E", "S", "W"] as const;

export type WallId = (typeof WALL_IDS)[number];

export const WALL_LABELS: Record<WallId, string> = {
  N: "Noord",
  E: "Oost",
  S: "Zuid",
  W: "West",
};

/** Opposing pairs. Both members must agree within `WALL_MATCH_TOLERANCE_M`. */
export const OPPOSING_WALLS: ReadonlyArray<readonly [WallId, WallId]> = [
  ["N", "S"],
  ["E", "W"],
];

/**
 * A door or window in a wall.
 *
 * `offsetFromLeft` is measured along the wall in the direction the floor plan
 * draws it — N and S left-to-right, E and W top-to-bottom — so the same number
 * places the opening identically in the SVG and in the exported plan.
 */
export type Opening = {
  width: number;
  height: number;
  offsetFromLeft: number;
};

export type Wall = {
  id: WallId;
  label: string;
  length: number;
  height: number;
  doors: Opening[];
  windows: Opening[];
};

/** Derived footprint numbers. Always computed server-side, never trusted from the client. */
export type RoomFootprint = {
  width: number;
  depth: number;
  height: number;
  area: number;
  perimeter: number;
};

export type ScanMethod = "lidar" | "manual";

/** The full payload persisted to `projects.room_dimensions`. */
export type RoomDimensions = {
  source: string;
  dimensions: RoomFootprint;
  walls: Wall[];
  accuracy: string;
  scanMethod: ScanMethod;
  roomType?: RoomTypeId;
  capturedAt?: string;
};

/**
 * Room types offered in manual step 1, mapped onto the `renovation_type` CHECK
 * constraint in `projects` (001_init.sql) so the wizard can set it on save.
 */
export const ROOM_TYPES = [
  { id: "kitchen", label: "Keuken", icon: "🍳" },
  { id: "bathroom", label: "Badkamer", icon: "🚿" },
  { id: "living_room", label: "Woonkamer", icon: "🛋️" },
  { id: "bedroom", label: "Slaapkamer", icon: "🛏️" },
  { id: "open_plan", label: "Open plattegrond", icon: "🏗️" },
  { id: "extension", label: "Aanbouw", icon: "🏠" },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]["id"];

export function isRoomTypeId(value: unknown): value is RoomTypeId {
  return (
    typeof value === "string" &&
    ROOM_TYPES.some((roomType) => roomType.id === value)
  );
}

export function isWallId(value: unknown): value is WallId {
  return typeof value === "string" && (WALL_IDS as readonly string[]).includes(value);
}

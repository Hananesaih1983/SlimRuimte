import { isUuid, jsonError, readJsonBody, requireApiRole } from "@/lib/api-auth";
import {
  PROJECT_STATUS_PLAN_READY,
  PROJECT_STATUS_SCANNING,
  isRenovationType,
} from "@/lib/projects";
import { computeFootprint, parseWall, validateWalls } from "@/lib/scan/geometry";
import {
  WALL_IDS,
  type RoomDimensions,
  type Wall,
  isRoomTypeId,
} from "@/lib/scan/types";

/**
 * POST /api/scan/manual-save — persist a manually measured room.
 *
 * Body: { projectId, walls: Wall[], roomType?, height? }
 *
 * Everything the client sends is treated as untrusted input: the wall list is
 * re-parsed, re-validated and the footprint recomputed here. The wizard runs
 * the same functions for live feedback, but this is the copy that gates the
 * write — a hand-rolled POST cannot store a room that does not close.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("homeowner");
  if (auth.error) return auth.error;

  const { user, supabase } = auth.ctx;

  const body = await readJsonBody(request);
  if (!body) return jsonError("Ongeldige aanvraag.", 400);

  const projectId = body.projectId;
  if (!isUuid(projectId)) {
    return jsonError("Ongeldig project.", 400);
  }

  const walls = parseWalls(body.walls);
  if (!walls) {
    return jsonError("Ongeldige muurgegevens.", 400);
  }

  if (walls.length !== WALL_IDS.length) {
    return jsonError("Meet alle vier de muren voordat je opslaat.", 400, {
      issues: [{ wallId: null, message: "Niet alle muren zijn ingevuld." }],
    });
  }

  const issues = validateWalls(walls);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return jsonError(errors[0].message, 422, { issues: errors });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, renovation_type")
    .eq("id", projectId)
    .eq("homeowner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) {
    return jsonError("Project niet gevonden.", 404);
  }

  // area = width * depth, perimeter = 2 * (width + depth), with each dimension
  // averaged from its opposing pair.
  const footprint = computeFootprint(
    walls,
    typeof body.height === "number" ? body.height : undefined,
  );

  const roomType = isRoomTypeId(body.roomType) ? body.roomType : undefined;

  const dimensions: RoomDimensions = {
    source: "manual_entry",
    dimensions: footprint,
    walls,
    accuracy: "±0.5-2cm (handmatig)",
    scanMethod: "manual",
    ...(roomType ? { roomType } : {}),
    capturedAt: new Date().toISOString(),
  };

  // Mark the project as in-flight first, so a failure on the write below leaves
  // an accurate 'scanning' state rather than a stale 'draft'.
  await supabase
    .from("projects")
    .update({ status: PROJECT_STATUS_SCANNING })
    .eq("id", projectId)
    .eq("homeowner_id", user.id);

  // The room type doubles as the renovation type, but never overwrite one the
  // homeowner already chose elsewhere.
  const renovationType =
    project.renovation_type ?? (roomType && isRenovationType(roomType) ? roomType : null);

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      room_dimensions: dimensions,
      scan_method: "manual",
      scan_source: "manual_entry",
      renovation_type: renovationType,
      status: PROJECT_STATUS_PLAN_READY,
    })
    .eq("id", projectId)
    .eq("homeowner_id", user.id);

  if (updateError) {
    console.error("[scan/manual-save] update failed", updateError);
    return jsonError("Opslaan van de maten is mislukt.", 500);
  }

  return Response.json({
    success: true,
    projectId,
    dimensions,
    redirect: `/homeowner/project/${projectId}`,
  });
}

/** Parses and de-duplicates the wall list, returning `null` on malformed input. */
function parseWalls(input: unknown): Wall[] | null {
  if (!Array.isArray(input)) return null;

  const byId = new Map<string, Wall>();
  for (const entry of input) {
    const wall = parseWall(entry);
    if (!wall) return null;
    byId.set(wall.id, wall);
  }

  // Return in canonical N/E/S/W order so stored JSON is stable across saves.
  return WALL_IDS.map((id) => byId.get(id)).filter(
    (wall): wall is Wall => wall !== undefined,
  );
}

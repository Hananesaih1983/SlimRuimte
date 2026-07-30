import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { isUuid, jsonError, requireApiRole } from "@/lib/api-auth";
import { PROJECT_STATUS_PLAN_READY } from "@/lib/projects";
import { computeFootprint } from "@/lib/scan/geometry";
import { parseCapturedRoom } from "@/lib/scan/roomplan";
import type { RoomDimensions } from "@/lib/scan/types";

/**
 * POST /api/scan/roomplan-upload — import an Apple RoomPlan scan.
 *
 * multipart/form-data: { file: Room.json, projectId: uuid }
 *
 * Replaces the magicplan path in /api/scan/import. The capture happens in the
 * free 3D Scanner App (Laan Labs), which wraps Apple's RoomPlan and exports
 * ARKit's own `CapturedRoom` JSON — so there is no API, no key and no per-scan
 * cost, and the file the homeowner uploads is the raw LiDAR result.
 *
 * The Apple → `RoomDimensions` mapping lives in `src/lib/scan/roomplan.ts`.
 */

const ACCURACY = "±1-2cm (Apple RoomPlan)";

/** A Room.json is well under a megabyte; this only stops abusive uploads. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiRole("homeowner");
  if (auth.error) return auth.error;

  const { user, supabase } = auth.ctx;

  // Checked BEFORE `formData()`, which buffers the entire body into memory —
  // rejecting afterwards means a 50 MB (or 5 GB) upload is already resident
  // before we decline it, which on a small Vercel function is the whole attack.
  // The `file.size` check below still stands as the authority; this only stops
  // us from paying for the read.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return jsonError("Het bestand is te groot (max 10 MB).", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Ongeldige upload.", 400);
  }

  const file = form.get("file");
  const projectId = form.get("projectId");

  if (!(file instanceof File) || file.size === 0) {
    return jsonError(
      "Selecteer een geldig Room.json bestand (geëxporteerd uit 3D Scanner App).",
      400,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("Het bestand is te groot (max 10 MB).", 413);
  }
  if (typeof projectId !== "string" || !isUuid(projectId)) {
    return jsonError("Ongeldig project.", 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return jsonError(
      "Dit bestand is geen geldige JSON. Exporteer opnieuw als Room.json uit de 3D Scanner App.",
      400,
    );
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonError("Onverwachte inhoud in Room.json.", 400);
  }

  const raw = payload as Record<string, unknown>;

  if (!Array.isArray(raw.walls) || raw.walls.length === 0) {
    return jsonError(
      "Dit bestand bevat geen muren. Kies ‘Room.json’ bij Exporteer — niet USDZ of OBJ.",
      400,
    );
  }

  const walls = parseCapturedRoom(raw);

  if (!walls) {
    return jsonError(
      "De scan bevat geen gesloten ruimte. Loop in de app langs alle muren tot de plattegrond dichtloopt en exporteer opnieuw.",
      400,
    );
  }

  const dimensions: RoomDimensions = {
    source: "roomplan",
    // Averages each opposing pair into one width/depth, so `area` is the
    // footprint's bounding box and `perimeter` the sum of the four wall runs.
    dimensions: computeFootprint(walls),
    walls,
    accuracy: ACCURACY,
    scanMethod: "lidar",
    capturedAt: new Date().toISOString(),
  };

  // Ownership is checked on the caller's own (RLS-scoped) client before the
  // service role is used at all, so the elevated write can only ever land on a
  // project this user already has access to.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("homeowner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) {
    return jsonError("Project niet gevonden.", 404);
  }

  const { error: updateError } = await writeClient(supabase)
    .from("projects")
    .update({
      room_dimensions: dimensions,
      scan_method: "lidar",
      scan_source: "roomplan",
      status: PROJECT_STATUS_PLAN_READY,
    })
    .eq("id", projectId)
    .eq("homeowner_id", user.id);

  if (updateError) {
    console.error("[scan/roomplan-upload] update failed", updateError);
    return jsonError("Opslaan van de scan is mislukt.", 500);
  }

  return Response.json({
    success: true,
    dimensions,
    projectId,
    accuracy: ACCURACY,
  });
}

/**
 * Service-role client for the write, falling back to the caller's client when
 * the key is absent (local dev) — RLS already permits a homeowner to update
 * their own project, so the fallback path behaves identically.
 */
function writeClient(fallback: SupabaseClient): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !url) return fallback;

  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

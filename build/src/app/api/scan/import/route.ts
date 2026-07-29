// DEPRECATED: magicplan path — use /api/scan/roomplan-upload for RoomPlan instead

import { isUuid, jsonError, readJsonBody, requireApiRole } from "@/lib/api-auth";
import { PROJECT_STATUS_PLAN_READY } from "@/lib/projects";
import { computeFootprint, parseWall, roundCm } from "@/lib/scan/geometry";
import {
  WALL_LABELS,
  type RoomDimensions,
  type Wall,
} from "@/lib/scan/types";

/**
 * POST /api/scan/import — pull a finished magicplan scan into a project.
 *
 * Body: { projectCode: string, projectId: string }
 *
 * magicplan has not issued us an API key yet, so this runs against a mock by
 * default. The switch is `MAGICPLAN_API_KEY`: unset or literally `mock` returns
 * the fixture below; anything else attempts the real v2 call. That keeps the
 * whole LiDAR path exercisable end-to-end today and turns live the moment the
 * key lands, with no code change.
 */

const MAGICPLAN_API_BASE = "https://app.magicplan.app/api/v2";
const MAGICPLAN_TIMEOUT_MS = 15_000;

export async function POST(request: Request) {
  const auth = await requireApiRole("homeowner");
  if (auth.error) return auth.error;

  const { user, supabase } = auth.ctx;

  const body = await readJsonBody(request);
  if (!body) return jsonError("Ongeldige aanvraag.", 400);

  const projectCode =
    typeof body.projectCode === "string" ? body.projectCode.trim() : "";
  const projectId = body.projectId;

  if (projectCode === "") {
    return jsonError("Vul je magicplan-projectcode in.", 400);
  }
  if (!isUuid(projectId)) {
    return jsonError("Ongeldig project.", 400);
  }

  // Confirm the project exists and belongs to the caller before we spend an
  // upstream API call on it. RLS would block the write anyway, but this turns a
  // silent zero-row update into a clear 404.
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

  let dimensions: RoomDimensions;
  try {
    dimensions = await fetchScan(projectCode);
  } catch (error) {
    console.error("[scan/import] magicplan fetch failed", error);
    const message =
      error instanceof MagicplanError
        ? error.message
        : "De magicplan-import is mislukt. Probeer het opnieuw.";
    return jsonError(message, 502);
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      room_dimensions: dimensions,
      scan_method: "lidar",
      scan_source: dimensions.source === "mock" ? "magicplan_mock" : "magicplan",
      magicplan_project_id: projectCode,
      status: PROJECT_STATUS_PLAN_READY,
    })
    .eq("id", projectId)
    .eq("homeowner_id", user.id);

  if (updateError) {
    console.error("[scan/import] update failed", updateError);
    return jsonError("Opslaan van de scan is mislukt.", 500);
  }

  return Response.json({
    success: true,
    projectId,
    ...dimensions,
    redirect: `/homeowner/project/${projectId}`,
  });
}

class MagicplanError extends Error {}

async function fetchScan(projectCode: string): Promise<RoomDimensions> {
  const apiKey = process.env.MAGICPLAN_API_KEY;

  if (!apiKey || apiKey === "mock") {
    return mockScan();
  }

  const response = await fetch(
    `${MAGICPLAN_API_BASE}/plans/${encodeURIComponent(projectCode)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(MAGICPLAN_TIMEOUT_MS),
    },
  );

  if (response.status === 404) {
    throw new MagicplanError(
      "Geen plattegrond gevonden met deze projectcode. Controleer de code in de magicplan-app.",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new MagicplanError(
      "Geen toegang tot magicplan. Neem contact op met support.",
    );
  }
  if (!response.ok) {
    throw new MagicplanError(
      `magicplan gaf een fout (${response.status}). Probeer het later opnieuw.`,
    );
  }

  return normaliseMagicplanPlan(await response.json());
}

/**
 * Maps a magicplan v2 plan onto our `RoomDimensions`.
 *
 * UNVERIFIED against the real API — we have no key and no sandbox, so the field
 * names below are inferred from magicplan's public v2 documentation. Re-check
 * this function against a real payload before the first live import; the mock
 * path above is unaffected either way.
 */
function normaliseMagicplanPlan(payload: unknown): RoomDimensions {
  if (typeof payload !== "object" || payload === null) {
    throw new MagicplanError("Onverwacht antwoord van magicplan.");
  }

  const raw = payload as Record<string, unknown>;
  const room = firstRoom(raw) ?? raw;
  const rawWalls = (room as Record<string, unknown>).walls;

  const walls = Array.isArray(rawWalls)
    ? rawWalls
        .map((wall, index) => parseWall(withFallbackId(wall, index)))
        .filter((wall): wall is Wall => wall !== null)
    : [];

  if (walls.length === 0) {
    throw new MagicplanError(
      "De plattegrond bevat geen bruikbare muren. Rond de scan af in magicplan en probeer opnieuw.",
    );
  }

  return {
    source: "magicplan",
    dimensions: computeFootprint(walls),
    walls,
    accuracy: "±1-2cm (LiDAR)",
    scanMethod: "lidar",
    capturedAt: new Date().toISOString(),
  };
}

function firstRoom(raw: Record<string, unknown>): unknown {
  for (const key of ["room", "rooms", "floors"]) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) return value[0];
    if (value && typeof value === "object") return value;
  }
  return null;
}

/** magicplan walls are ordered, not compass-labelled; map index -> N/E/S/W. */
function withFallbackId(wall: unknown, index: number): unknown {
  if (typeof wall !== "object" || wall === null) return wall;

  const raw = wall as Record<string, unknown>;
  const id = raw.id ?? (["N", "E", "S", "W"][index % 4] as string);

  return {
    ...raw,
    id,
    label: raw.label ?? WALL_LABELS[id as keyof typeof WALL_LABELS] ?? String(id),
    length: raw.length ?? raw.lengthMeters ?? raw.size,
    height: raw.height ?? raw.heightMeters ?? 2.6,
  };
}

/**
 * Fixture used until the magicplan key arrives: a 4.20 x 3.40 m room with a
 * door on the east wall and windows north and south. Deliberately realistic —
 * a plausible Dutch kitchen — so downstream stages (floor plan, GLB, renders)
 * get representative input rather than a perfect square.
 */
function mockScan(): RoomDimensions {
  const walls: Wall[] = [
    {
      id: "N",
      label: "Noord",
      length: 4.2,
      height: 2.6,
      doors: [],
      windows: [{ width: 1.2, height: 1.4, offsetFromLeft: 1.5 }],
    },
    {
      id: "E",
      label: "Oost",
      length: 3.4,
      height: 2.6,
      doors: [{ width: 0.9, height: 2.1, offsetFromLeft: 0.6 }],
      windows: [],
    },
    {
      id: "S",
      label: "Zuid",
      length: 4.2,
      height: 2.6,
      doors: [],
      windows: [{ width: 1.2, height: 1.4, offsetFromLeft: 2.5 }],
    },
    { id: "W", label: "West", length: 3.4, height: 2.6, doors: [], windows: [] },
  ];

  return {
    source: "mock",
    dimensions: {
      width: 4.2,
      depth: 3.4,
      height: 2.6,
      area: roundCm(4.2 * 3.4),
      perimeter: roundCm(2 * (4.2 + 3.4)),
    },
    walls,
    accuracy: "±1-2cm (LiDAR)",
    scanMethod: "lidar",
  };
}

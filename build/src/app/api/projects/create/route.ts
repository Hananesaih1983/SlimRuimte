import { isUuid, jsonError, readJsonBody, requireApiRole } from "@/lib/api-auth";
import {
  DEFAULT_COUNTRY,
  PROJECT_STATUS_DRAFT,
  isCountry,
  isRenovationType,
} from "@/lib/projects";

/**
 * POST /api/projects/create
 *
 * Creates the empty project the scan flow hangs off. Called before the user
 * picks a scan path so that both paths have a row to write `room_dimensions`
 * into, and so an abandoned scan leaves a resumable draft rather than nothing.
 *
 * Body: { renovation_type?, country?, postcode?, title? } — all optional.
 * `renovation_type` is genuinely unknown at this point on the LiDAR path (the
 * room type is only asked in manual step 1), and the column is nullable, so it
 * is filled in later by /api/scan/manual-save.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("homeowner");
  if (auth.error) return auth.error;

  const { user, supabase } = auth.ctx;
  const body = (await readJsonBody(request)) ?? {};

  const renovationType = body.renovation_type ?? body.renovationType;
  if (renovationType != null && !isRenovationType(renovationType)) {
    return jsonError("Ongeldig renovatietype.", 400);
  }

  const country = body.country ?? DEFAULT_COUNTRY;
  if (!isCountry(country)) {
    return jsonError("Ongeldig land. Kies NL of BE.", 400);
  }

  const postcode = normalisePostcode(body.postcode);
  if (postcode === false) {
    return jsonError("Ongeldige postcode.", 400);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      homeowner_id: user.id,
      status: PROJECT_STATUS_DRAFT,
      renovation_type: renovationType ?? null,
      country,
      postcode,
      title: typeof body.title === "string" && body.title.trim() !== ""
        ? body.title.trim().slice(0, 120)
        : null,
    })
    .select("id")
    .single();

  if (error || !isUuid(data?.id)) {
    console.error("[projects/create] insert failed", error);
    return jsonError("Project aanmaken mislukt. Probeer het opnieuw.", 500);
  }

  return Response.json({ projectId: data.id }, { status: 201 });
}

/** Returns the cleaned postcode, `null` when absent, or `false` when invalid. */
function normalisePostcode(value: unknown): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;

  const cleaned = value.trim().toUpperCase().replace(/\s+/g, " ");
  // NL "1234 AB" / "1234AB", BE "1000" — kept permissive on purpose, this is a
  // convenience field and a wrong postcode must not block a scan.
  return cleaned.length <= 10 ? cleaned : false;
}

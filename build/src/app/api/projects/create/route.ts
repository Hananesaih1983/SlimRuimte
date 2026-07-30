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

  const { user, role, supabase } = auth.ctx;
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
      // Required by 003_pro_initiated_workflow, which explicitly delegates these
      // to the application layer ("the application layer MUST set initiated_by =
      // auth.uid() and workflow_type on insert"). Leaving them null is not
      // cosmetic: `project_delete` is USING (initiated_by = auth.uid() OR
      // is_admin()), so a homeowner could never delete their own project, and
      // `user_can_see_project_asset()` grants unconditional access to the
      // initiator — without it the homeowner falls through to the
      // `professional_visibility_settings` branch, which defaults to all-false
      // and would hide their own renders from them.
      initiated_by: user.id,
      // The column's CHECK constraint has no 'admin' member, so an admin using
      // this route leaves it null rather than failing the insert with a 23514.
      initiated_by_role: role === "admin" ? null : role,
      workflow_type: "homeowner_initiated",
    })
    .select("id")
    .single();

  if (error || !isUuid(data?.id)) {
    console.error("[projects/create] insert failed", error);
    return jsonError("Project aanmaken mislukt. Probeer het opnieuw.", 500);
  }

  return Response.json({ projectId: data.id }, { status: 201 });
}

/**
 * NL postcodes are 4 digits + 2 letters ("1234 AB"), BE are 4 digits ("1000").
 * Normalised to the canonical spaced NL form so contractor-matching can compare
 * and prefix-match them later without re-cleaning every row.
 */
const NL_POSTCODE = /^(\d{4})\s?([A-Z]{2})$/;
const BE_POSTCODE = /^\d{4}$/;

/**
 * Returns the cleaned postcode, `null` when absent, or `false` when invalid.
 *
 * The field stays optional — a scan must never be blocked on it — but a value
 * that IS supplied is now format-checked. The previous rule accepted any string
 * of 10 characters or fewer, so `"<script>x"` and `"'; DROP--"` were both stored
 * verbatim in a column that feeds postcode-radius matching in F09.
 */
function normalisePostcode(value: unknown): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;

  const cleaned = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (cleaned === "") return null;

  const nl = NL_POSTCODE.exec(cleaned);
  if (nl) return `${nl[1]} ${nl[2]}`;

  return BE_POSTCODE.test(cleaned) ? cleaned : false;
}

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeSession,
  createMockSupabase,
  resetDatabase,
  signIn,
  testUuid,
  type MockDatabase,
} from "../helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(activeSession.db, activeSession.user),
}));

const { POST } = await import("@/app/api/projects/create/route");

const HOMEOWNER = testUuid(1);
const CONTRACTOR = testUuid(2);
const ADMIN = testUuid(3);

let db: MockDatabase;

function post(body: unknown): Request {
  return new Request("http://localhost/api/projects/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  db = resetDatabase();
  db.seed("users", [
    { id: HOMEOWNER, role: "homeowner", deleted_at: null },
    { id: CONTRACTOR, role: "contractor", deleted_at: null },
    { id: ADMIN, role: "admin", deleted_at: null },
  ]);
});

describe("POST /api/projects/create", () => {
  it("returns 201 and a project uuid for a homeowner", async () => {
    signIn({ id: HOMEOWNER });

    const response = await POST(post({ renovation_type: "kitchen", country: "NL" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(db.rows("projects")).toHaveLength(1);
    expect(db.rows("projects")[0]).toMatchObject({
      homeowner_id: HOMEOWNER,
      status: "draft",
      renovation_type: "kitchen",
    });
  });

  it("rejects a contractor with 403", async () => {
    signIn({ id: CONTRACTOR });

    const response = await POST(post({ renovation_type: "kitchen" }));

    expect(response.status).toBe(403);
    expect(db.rows("projects")).toHaveLength(0);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    signIn(null);

    const response = await POST(post({ renovation_type: "kitchen" }));

    expect(response.status).toBe(401);
    expect(db.rows("projects")).toHaveLength(0);
  });

  it("rejects a signed-in user with no row in public.users with 403", async () => {
    // A JWT alone is not authorisation: the role comes from the database.
    signIn({ id: testUuid(99) });

    expect((await POST(post({}))).status).toBe(403);
  });

  it("ignores a forged role in user_metadata", async () => {
    // auth.updateUser() lets a user rewrite their own metadata, so the route
    // must read public.users and never the JWT claim.
    signIn({ id: CONTRACTOR, user_metadata: { role: "homeowner" } });

    expect((await POST(post({}))).status).toBe(403);
  });

  it("lets an admin through (full platform access per the permission matrix)", async () => {
    signIn({ id: ADMIN });

    expect((await POST(post({}))).status).toBe(201);
  });

  it("rejects an unknown renovation_type with 400", async () => {
    signIn({ id: HOMEOWNER });

    const response = await POST(post({ renovation_type: "wine_cellar" }));

    expect(response.status).toBe(400);
    expect(db.rows("projects")).toHaveLength(0);
  });

  it("rejects a SQL injection attempt in renovation_type with 400", async () => {
    signIn({ id: HOMEOWNER });

    const response = await POST(
      post({ renovation_type: "kitchen'; DROP TABLE projects; --" }),
    );

    expect(response.status).toBe(400);
    expect(db.tables.has("projects")).toBe(false);
  });

  it("accepts a create with no renovation_type", async () => {
    // Deviation from the written test plan, which expected 400. The LiDAR path
    // does not know the room type at this point (it is only asked in manual step
    // 1) and PathSelector posts `{country:"NL"}` alone, so requiring it here
    // would break the LiDAR flow outright. The column is nullable and
    // /api/scan/manual-save fills it in.
    signIn({ id: HOMEOWNER });

    const response = await POST(post({ country: "NL" }));

    expect(response.status).toBe(201);
    expect(db.rows("projects")[0].renovation_type).toBeNull();
  });

  it("rejects an unknown country with 400", async () => {
    signIn({ id: HOMEOWNER });

    expect((await POST(post({ country: "DE" }))).status).toBe(400);
  });

  describe("postcode validation", () => {
    it.each([
      ["<script>x", "html injection"],
      ["'; DROP--", "sql injection"],
      ["ABCDEF", "letters only"],
      ["12345", "five digits"],
      ["1234 ABC", "three letters"],
      [{ toString: () => "1234 AB" }, "non-string"],
    ])("rejects %j (%s) with 400", async (postcode) => {
      signIn({ id: HOMEOWNER });

      const response = await POST(post({ postcode }));

      expect(response.status).toBe(400);
      expect(db.rows("projects")).toHaveLength(0);
    });

    it.each([
      ["1234ab", "1234 AB"],
      ["1234 ab", "1234 AB"],
      ["  1071 DJ  ", "1071 DJ"],
      ["1000", "1000"],
    ])("normalises %j to %j", async (input, expected) => {
      signIn({ id: HOMEOWNER });

      const response = await POST(post({ postcode: input }));

      expect(response.status).toBe(201);
      expect(db.rows("projects")[0].postcode).toBe(expected);
    });

    it("treats an absent postcode as null", async () => {
      signIn({ id: HOMEOWNER });

      expect((await POST(post({}))).status).toBe(201);
      expect(db.rows("projects")[0].postcode).toBeNull();
    });
  });

  it("stamps initiated_by so migration 003's policies apply to the row", async () => {
    // Without these, `project_delete` (USING initiated_by = auth.uid()) never
    // matches and the homeowner cannot delete their own project, and
    // user_can_see_project_asset() falls through to the visibility gate, which
    // defaults to all-false.
    signIn({ id: HOMEOWNER });
    await POST(post({}));

    expect(db.rows("projects")[0]).toMatchObject({
      initiated_by: HOMEOWNER,
      initiated_by_role: "homeowner",
      workflow_type: "homeowner_initiated",
    });
  });

  it("leaves initiated_by_role null for an admin (not in the CHECK constraint)", async () => {
    signIn({ id: ADMIN });
    await POST(post({}));

    expect(db.rows("projects")[0].initiated_by_role).toBeNull();
  });

  it("truncates an over-long title rather than failing", async () => {
    signIn({ id: HOMEOWNER });
    await POST(post({ title: "x".repeat(500) }));

    expect(String(db.rows("projects")[0].title)).toHaveLength(120);
  });

  it("returns 500, not a malformed 201, when the insert fails", async () => {
    signIn({ id: HOMEOWNER });
    db.failNextWrite = { message: "23514 check constraint" };

    const response = await POST(post({}));

    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty("error");
  });

  it("survives a malformed JSON body", async () => {
    signIn({ id: HOMEOWNER });

    const response = await POST(
      new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );

    // readJsonBody swallows the parse error and falls back to `{}`, so this is a
    // create with all-default fields rather than a 500.
    expect(response.status).toBe(201);
  });
});

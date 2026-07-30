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

/**
 * SECURITY PROPERTIES OF THE WEEK 1+2 WRITE PATH
 * ==============================================
 *
 * What these tests can and cannot prove — read this before trusting a green run.
 *
 * There are two independent gates on every write:
 *
 *   1. APPLICATION LAYER — `requireApiRole()` plus an explicit ownership filter
 *      on every query. Exercised here, in-process, against a mock Supabase that
 *      enforces NO row-level security at all (see helpers/supabase-mock.ts).
 *      That is the point: with the store wide open, a passing isolation test
 *      proves the ROUTE isolates on its own. If the mock re-implemented RLS the
 *      tests would be tautological — they would pass because the mock refused
 *      to return the row, saying nothing about the code under test.
 *
 *   2. DATABASE LAYER — Postgres RLS. Cannot run in vitest. Verified only by
 *      reading the migrations, and the reading found a HIGH severity hole:
 *      `projects` has no restrictive INSERT policy, so any authenticated user
 *      of any role can POST straight to PostgREST with the public anon key and
 *      insert a row with a spoofed `homeowner_id`, bypassing every test in this
 *      file. Migration 004 closes it. See
 *      `src/lib/supabase/migrations/004_fix_project_insert_rls.sql`.
 *
 * So: green here means the API routes are sound. It does NOT mean the database
 * is sound, because the attack that matters most does not go through the API.
 */

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(activeSession.db, activeSession.user),
  createServiceClient: async () => createMockSupabase(activeSession.db, activeSession.user),
}));

const { POST: createProject } = await import("@/app/api/projects/create/route");
const { POST: manualSave } = await import("@/app/api/scan/manual-save/route");

const HOMEOWNER_A = testUuid(1);
const HOMEOWNER_B = testUuid(2);
const CONTRACTOR = testUuid(3);
const DESIGNER = testUuid(4);
const AGENT = testUuid(5);
const ADMIN = testUuid(6);
const PROJECT_A = testUuid(20);
const PROJECT_B = testUuid(21);

let db: MockDatabase;

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validWalls() {
  return [
    { id: "N", length: 4.2, height: 2.6, doors: [], windows: [] },
    { id: "E", length: 3.4, height: 2.6, doors: [], windows: [] },
    { id: "S", length: 4.2, height: 2.6, doors: [], windows: [] },
    { id: "W", length: 3.4, height: 2.6, doors: [], windows: [] },
  ];
}

beforeEach(() => {
  db = resetDatabase();
  db.seed("users", [
    { id: HOMEOWNER_A, role: "homeowner", deleted_at: null },
    { id: HOMEOWNER_B, role: "homeowner", deleted_at: null },
    { id: CONTRACTOR, role: "contractor", deleted_at: null },
    { id: DESIGNER, role: "interior_designer", deleted_at: null },
    { id: AGENT, role: "estate_agent", deleted_at: null },
    { id: ADMIN, role: "admin", deleted_at: null },
  ]);
  db.seed("projects", [
    { id: PROJECT_A, homeowner_id: HOMEOWNER_A, status: "draft", renovation_type: null, deleted_at: null },
    { id: PROJECT_B, homeowner_id: HOMEOWNER_B, status: "draft", renovation_type: null, deleted_at: null },
  ]);
});

describe("role isolation on /api/projects/create", () => {
  const nonHomeowners: Array<[string, string]> = [
    ["contractor", CONTRACTOR],
    ["interior_designer", DESIGNER],
    ["estate_agent", AGENT],
  ];

  it.each(nonHomeowners)("rejects a %s with 403", async (_role, userId) => {
    signIn({ id: userId });

    const response = await createProject(post("/api/projects/create", {}));

    expect(response.status).toBe(403);
    expect(db.rows("projects")).toHaveLength(2);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    signIn(null);

    expect((await createProject(post("/api/projects/create", {}))).status).toBe(401);
  });

  it("reads the role from public.users, never from user_metadata", async () => {
    // auth.updateUser() lets a user rewrite their own metadata, so a route that
    // trusted it would hand out any role on request.
    signIn({ id: CONTRACTOR, user_metadata: { role: "admin" } });

    expect((await createProject(post("/api/projects/create", {}))).status).toBe(403);
  });

  it("rejects a signed-in user with no row in public.users", async () => {
    signIn({ id: testUuid(99) });

    expect((await createProject(post("/api/projects/create", {}))).status).toBe(403);
  });

  it("rejects a soft-deleted account", async () => {
    db.seed("users", [{ id: testUuid(98), role: "homeowner", deleted_at: "2026-01-01" }]);
    signIn({ id: testUuid(98) });

    expect((await createProject(post("/api/projects/create", {}))).status).toBe(403);
  });

  it("stamps homeowner_id from the session, ignoring any client-supplied value", async () => {
    signIn({ id: HOMEOWNER_A });

    await createProject(
      post("/api/projects/create", { homeowner_id: HOMEOWNER_B, initiated_by: HOMEOWNER_B }),
    );

    const created = db.rows("projects").find((row) => row.id !== PROJECT_A && row.id !== PROJECT_B)!;
    expect(created.homeowner_id).toBe(HOMEOWNER_A);
    expect(created.initiated_by).toBe(HOMEOWNER_A);
  });
});

describe("cross-user project isolation on /api/scan/manual-save", () => {
  it("refuses to write to another user's project", async () => {
    signIn({ id: HOMEOWNER_A });

    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: PROJECT_B, walls: validWalls() }),
    );

    // 404 rather than 403, deliberately: a 403 would confirm the uuid exists,
    // turning the endpoint into an oracle for enumerating other users' projects.
    expect(response.status).toBe(404);

    const victim = db.rows("projects").find((row) => row.id === PROJECT_B)!;
    expect(victim.room_dimensions).toBeUndefined();
    expect(victim.status).toBe("draft");
  });

  it("leaves the victim's project status untouched by a failed cross-user write", async () => {
    signIn({ id: HOMEOWNER_A });

    await manualSave(post("/api/scan/manual-save", { projectId: PROJECT_B, walls: validWalls() }));

    // Ownership is checked BEFORE the "mark as scanning" write, so an attacker
    // cannot even flip a stranger's project into a mid-scan state.
    expect(db.rows("projects").find((row) => row.id === PROJECT_B)!.status).toBe("draft");
  });

  it("lets the owner write to their own project", async () => {
    signIn({ id: HOMEOWNER_A });

    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: PROJECT_A, walls: validWalls() }),
    );

    expect(response.status).toBe(200);
  });

  it("does not resurrect a soft-deleted project", async () => {
    db.seed("projects", [
      { id: testUuid(30), homeowner_id: HOMEOWNER_A, status: "draft", deleted_at: "2026-01-01" },
    ]);
    signIn({ id: HOMEOWNER_A });

    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: testUuid(30), walls: validWalls() }),
    );

    expect(response.status).toBe(404);
  });
});

describe("injection is structurally impossible through these routes", () => {
  const payloads = [
    "kitchen'; DROP TABLE projects; --",
    "' OR '1'='1",
    "kitchen UNION SELECT * FROM users",
    "'; UPDATE projects SET homeowner_id = 'x'; --",
  ];

  it.each(payloads)("rejects %s as a renovation_type before it reaches the driver", async (payload) => {
    signIn({ id: HOMEOWNER_A });

    const response = await createProject(post("/api/projects/create", { renovation_type: payload }));

    // Two independent reasons this is safe, and the test asserts the first:
    //  1. `isRenovationType` is an allowlist — anything not in the CHECK
    //     constraint's member list is a 400 and never reaches the database.
    //  2. supabase-js sends values as JSON to PostgREST, which binds them as
    //     parameters. String interpolation into SQL never happens; the payload
    //     would land in the column verbatim, not execute.
    expect(response.status).toBe(400);
    expect(db.rows("projects")).toHaveLength(2);
  });

  it("stores a malicious postcode nowhere — the format check rejects it", async () => {
    signIn({ id: HOMEOWNER_A });

    const response = await createProject(
      post("/api/projects/create", { postcode: "'; DROP--" }),
    );

    expect(response.status).toBe(400);
  });

  it("stores a script-shaped title verbatim rather than executing or stripping it", async () => {
    signIn({ id: HOMEOWNER_A });

    await createProject(post("/api/projects/create", { title: "<script>alert(1)</script>" }));

    const created = db.rows("projects").find((row) => row.id !== PROJECT_A && row.id !== PROJECT_B)!;
    // Escaping belongs at the render boundary (React escapes by default), not
    // at the storage boundary — sanitising on write loses the user's real data
    // and gives a false sense of safety everywhere it is later re-serialised.
    expect(created.title).toBe("<script>alert(1)</script>");
  });
});

describe("type confusion in measurements is rejected, not coerced", () => {
  beforeEach(() => {
    signIn({ id: HOMEOWNER_A });
  });

  const badLengths: Array<[string, unknown]> = [
    ["a non-numeric string", "vier meter"],
    ["a boolean", true],
    ["null", null],
    ["an object", { valueOf: () => 4.2 }],
    ["an array", [4.2]],
    ["NaN as a string", "NaN"],
    ["Infinity", "Infinity"],
  ];

  it.each(badLengths)("rejects %s as a wall length with 400", async (_label, length) => {
    const walls = validWalls();
    walls[0] = { ...walls[0], length: length as number };

    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: PROJECT_A, walls }),
    );

    expect(response.status).toBe(400);
    expect(db.rows("projects").find((row) => row.id === PROJECT_A)!.room_dimensions).toBeUndefined();
  });

  it("accepts a numeric string, which is what an HTML form actually posts", async () => {
    const walls = validWalls().map((wall) => ({ ...wall, length: String(wall.length) }));

    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: PROJECT_A, walls }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects a non-uuid projectId before any query runs", async () => {
    const response = await manualSave(
      post("/api/scan/manual-save", { projectId: "' OR 1=1 --", walls: validWalls() }),
    );

    expect(response.status).toBe(400);
  });

  it("recomputes the footprint server-side, ignoring client-supplied figures", async () => {
    await manualSave(
      post("/api/scan/manual-save", {
        projectId: PROJECT_A,
        walls: validWalls(),
        dimensions: { area: 999, perimeter: 999 },
      }),
    );

    const saved = db.rows("projects").find((row) => row.id === PROJECT_A)!
      .room_dimensions as { dimensions: { area: number } };
    expect(saved.dimensions.area).toBeCloseTo(14.28, 2);
  });
});

describe("admin access follows the permission matrix", () => {
  it("lets an admin create a project", async () => {
    signIn({ id: ADMIN });

    expect((await createProject(post("/api/projects/create", {}))).status).toBe(201);
  });

  it("leaves initiated_by_role null for an admin, which the CHECK constraint has no member for", async () => {
    signIn({ id: ADMIN });

    await createProject(post("/api/projects/create", {}));

    const created = db.rows("projects").find((row) => row.id !== PROJECT_A && row.id !== PROJECT_B)!;
    expect(created.initiated_by_role).toBeNull();
  });
});

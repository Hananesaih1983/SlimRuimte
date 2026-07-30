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

const { POST } = await import("@/app/api/scan/manual-save/route");

const OWNER = testUuid(1);
const ATTACKER = testUuid(2);
const CONTRACTOR = testUuid(3);
const OWNER_PROJECT = testUuid(10);
const ATTACKER_PROJECT = testUuid(11);

let db: MockDatabase;

/** A 4.20 x 3.40 m room that closes cleanly — the happy path everywhere below. */
function validWalls(overrides: Record<string, unknown> = {}) {
  return [
    { id: "N", length: 4.2, height: 2.6, doors: [], windows: [] },
    { id: "E", length: 3.4, height: 2.6, doors: [], windows: [] },
    { id: "S", length: 4.2, height: 2.6, doors: [], windows: [] },
    { id: "W", length: 3.4, height: 2.6, doors: [], windows: [] },
  ].map((wall) => ({ ...wall, ...overrides[wall.id as string] as object }));
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/scan/manual-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  db = resetDatabase();
  db.seed("users", [
    { id: OWNER, role: "homeowner", deleted_at: null },
    { id: ATTACKER, role: "homeowner", deleted_at: null },
    { id: CONTRACTOR, role: "contractor", deleted_at: null },
  ]);
  db.seed("projects", [
    {
      id: OWNER_PROJECT,
      homeowner_id: OWNER,
      status: "draft",
      renovation_type: null,
      deleted_at: null,
    },
    {
      id: ATTACKER_PROJECT,
      homeowner_id: ATTACKER,
      status: "draft",
      renovation_type: null,
      deleted_at: null,
    },
  ]);
});

function ownerProject() {
  return db.rows("projects").find((row) => row.id === OWNER_PROJECT)!;
}

describe("POST /api/scan/manual-save", () => {
  it("saves a valid 4-wall room and advances the status", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls(), roomType: "kitchen" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.redirect).toBe(`/homeowner/project/${OWNER_PROJECT}`);

    const project = ownerProject();
    expect(project.status).toBe("renders_pending");
    expect(project.scan_method).toBe("manual");
    expect(project.scan_source).toBe("manual_entry");
    // The room type doubles as the renovation type when none was chosen earlier.
    expect(project.renovation_type).toBe("kitchen");

    const dimensions = project.room_dimensions as {
      dimensions: Record<string, number>;
      walls: unknown[];
      scanMethod: string;
    };
    expect(dimensions.scanMethod).toBe("manual");
    expect(dimensions.walls).toHaveLength(4);
    expect(dimensions.dimensions).toMatchObject({
      width: 4.2,
      depth: 3.4,
      area: 14.28,
      perimeter: 15.2,
      height: 2.6,
    });
  });

  it("recomputes the footprint server-side and ignores client-supplied figures", async () => {
    signIn({ id: OWNER });

    await POST(
      post({
        projectId: OWNER_PROJECT,
        walls: validWalls(),
        // A hand-rolled POST claiming a mansion.
        dimensions: { width: 99, depth: 99, area: 9801, perimeter: 396 },
      }),
    );

    const dimensions = ownerProject().room_dimensions as {
      dimensions: Record<string, number>;
    };
    expect(dimensions.dimensions.area).toBe(14.28);
  });

  it("never overwrites a renovation_type the homeowner already chose", async () => {
    signIn({ id: OWNER });
    ownerProject().renovation_type = "bathroom";

    await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls(), roomType: "kitchen" }),
    );

    expect(ownerProject().renovation_type).toBe("bathroom");
  });

  it("rejects opposing walls that differ by more than 5 cm", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls({ S: { length: 4.8 } }) }),
    );
    const payload = await response.json();

    // 422, not the 400 the written plan expected: the body parsed fine, the
    // geometry is what failed. Both are client errors and the wizard renders
    // `payload.error` for any non-2xx, so the user-visible behaviour matches.
    expect(response.status).toBe(422);
    expect(payload.error).toContain("5cm");
    expect(payload.issues[0].wallId).toBe("N");
    expect(ownerProject().room_dimensions).toBeUndefined();
    expect(ownerProject().status).toBe("draft");
  });

  it("accepts opposing walls within the 5 cm tolerance", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls({ S: { length: 4.24 } }) }),
    );

    expect(response.status).toBe(200);
    expect(ownerProject().status).toBe("renders_pending");
  });

  it("accepts a difference of exactly 5 cm", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls({ S: { length: 4.25 } }) }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects a request with no projectId", async () => {
    signIn({ id: OWNER });

    expect((await POST(post({ walls: validWalls() }))).status).toBe(400);
  });

  it("rejects a projectId that is not a uuid", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: "1 OR 1=1", walls: validWalls() }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a request with no walls", async () => {
    signIn({ id: OWNER });

    expect((await POST(post({ projectId: OWNER_PROJECT }))).status).toBe(400);
  });

  it("rejects a partially measured room", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls().slice(0, 3) }),
    );

    expect(response.status).toBe(400);
    expect(ownerProject().room_dimensions).toBeUndefined();
  });

  it("rejects duplicate wall ids that would fake a complete room", async () => {
    signIn({ id: OWNER });
    const walls = validWalls();

    const response = await POST(
      post({
        projectId: OWNER_PROJECT,
        walls: [walls[0], walls[0], walls[0], walls[0]],
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a wall of length 0", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls({ N: { length: 0 } }) }),
    );

    expect(response.status).toBe(422);
    expect(ownerProject().room_dimensions).toBeUndefined();
  });

  const badLengths: Array<[unknown, string]> = [
    ["DROP TABLE projects", "sql injection string"],
    [null, "null"],
    [true, "boolean"],
    [[], "empty array"],
    ["", "empty string"],
    ["NaN", "NaN literal"],
  ];

  it.each(badLengths)("rejects a wall length of %j (%s)", async (length, label) => {
    signIn({ id: OWNER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls({ N: { length } }) }),
    );

    expect(response.status, label).toBe(400);
    expect(ownerProject().room_dimensions).toBeUndefined();
  });

  it("rejects an opening wider than the wall holding it", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      post({
        projectId: OWNER_PROJECT,
        walls: validWalls({
          N: { doors: [{ width: 1.2, height: 2.1, offsetFromLeft: 3.6 }] },
        }),
      }),
    );

    expect(response.status).toBe(422);
  });

  it("does not let a boolean opening width become a real 1 m door", async () => {
    signIn({ id: OWNER });

    await POST(
      post({
        projectId: OWNER_PROJECT,
        walls: validWalls({
          N: { doors: [{ width: true, height: true, offsetFromLeft: 0 }] },
        }),
      }),
    );

    const dimensions = ownerProject().room_dimensions as { walls: Array<{ doors: unknown[] }> };
    expect(dimensions.walls[0].doors).toHaveLength(0);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    signIn(null);

    const response = await POST(post({ projectId: OWNER_PROJECT, walls: validWalls() }));

    expect(response.status).toBe(401);
  });

  it("rejects a contractor with 403", async () => {
    signIn({ id: CONTRACTOR });

    const response = await POST(post({ projectId: OWNER_PROJECT, walls: validWalls() }));

    expect(response.status).toBe(403);
  });

  it("does not write to another user's project", async () => {
    // The written plan expected 403. 404 is what the route returns and is the
    // better answer: a 403 would confirm the id exists, turning the endpoint
    // into an existence oracle for other people's project ids.
    signIn({ id: ATTACKER });

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls() }),
    );

    expect(response.status).toBe(404);
    expect(ownerProject().room_dimensions).toBeUndefined();
    expect(ownerProject().status).toBe("draft");
  });

  it("does not leave the victim's project mid-scan on a cross-user attempt", async () => {
    // The route flips status to 'scanning' before writing dimensions. That must
    // happen after the ownership check, or a stranger could reset the state of
    // any project whose id they guessed.
    signIn({ id: ATTACKER });
    await POST(post({ projectId: OWNER_PROJECT, walls: validWalls() }));

    expect(ownerProject().status).toBe("draft");
  });

  it("does not resurrect a soft-deleted project", async () => {
    signIn({ id: OWNER });
    ownerProject().deleted_at = "2026-07-01T00:00:00Z";

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls() }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 500 and leaves an accurate 'scanning' status when the write fails", async () => {
    signIn({ id: OWNER });
    // Write 1 is the status flip to 'scanning'; write 2 stores the dimensions.
    db.failWriteAt = 2;

    const response = await POST(
      post({ projectId: OWNER_PROJECT, walls: validWalls() }),
    );

    expect(response.status).toBe(500);
    expect(ownerProject().room_dimensions).toBeUndefined();
    expect(ownerProject().status).toBe("scanning");
  });
});

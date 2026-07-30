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

// The route reaches for a service-role client to perform the write. Point it at
// the same in-memory store so both the elevated and the fallback path are
// exercised against identical data.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => createMockSupabase(activeSession.db, activeSession.user),
}));

const { POST } = await import("@/app/api/scan/roomplan-upload/route");

const OWNER = testUuid(1);
const ATTACKER = testUuid(2);
const CONTRACTOR = testUuid(3);
const OWNER_PROJECT = testUuid(10);

let db: MockDatabase;

/**
 * One Apple `CapturedRoom` surface. `simd_float4x4` serialises as 16
 * column-major floats: column 0 is the surface's local X axis in world space,
 * column 3 the translation.
 */
function surface(options: {
  length: number;
  height: number;
  cx: number;
  cz: number;
  alongX: boolean;
}) {
  const { length, height, cx, cz, alongX } = options;
  const axis = alongX ? [1, 0, 0, 0] : [0, 0, 1, 0];

  return {
    dimensions: [length, height, 0.1],
    transform: [...axis, 0, 1, 0, 0, 0, 0, 1, 0, cx, 1.3, cz, 1],
  };
}

/** A 4.20 x 3.40 m room centred on the origin, walls captured one per side. */
function capturedRoom(overrides: Record<string, unknown> = {}) {
  return {
    walls: [
      surface({ length: 4.2, height: 2.6, cx: 0, cz: -1.7, alongX: true }),
      surface({ length: 3.4, height: 2.6, cx: 2.1, cz: 0, alongX: false }),
      surface({ length: 4.2, height: 2.6, cx: 0, cz: 1.7, alongX: true }),
      surface({ length: 3.4, height: 2.6, cx: -2.1, cz: 0, alongX: false }),
    ],
    doors: [],
    windows: [],
    ...overrides,
  };
}

function upload(
  content: string | Blob,
  projectId: string | null = OWNER_PROJECT,
  filename = "Room.json",
): Request {
  const form = new FormData();
  if (content !== null) {
    form.append("file", new File([content], filename, { type: "application/json" }));
  }
  if (projectId !== null) form.append("projectId", projectId);

  return new Request("http://localhost/api/scan/roomplan-upload", {
    method: "POST",
    body: form,
  });
}

function uploadJson(payload: unknown, projectId?: string): Request {
  return upload(JSON.stringify(payload), projectId ?? OWNER_PROJECT);
}

beforeEach(() => {
  db = resetDatabase();
  db.seed("users", [
    { id: OWNER, role: "homeowner", deleted_at: null },
    { id: ATTACKER, role: "homeowner", deleted_at: null },
    { id: CONTRACTOR, role: "contractor", deleted_at: null },
  ]);
  db.seed("projects", [
    { id: OWNER_PROJECT, homeowner_id: OWNER, status: "draft", deleted_at: null },
  ]);
});

function ownerProject() {
  return db.rows("projects").find((row) => row.id === OWNER_PROJECT)!;
}

describe("POST /api/scan/roomplan-upload", () => {
  it("parses a valid Room.json into four walls and saves it", async () => {
    signIn({ id: OWNER });

    const response = await POST(uploadJson(capturedRoom()));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.accuracy).toBe("±1-2cm (Apple RoomPlan)");
    expect(payload.dimensions.walls).toHaveLength(4);
    expect(payload.dimensions.dimensions).toMatchObject({
      width: 4.2,
      depth: 3.4,
      area: 14.28,
      perimeter: 15.2,
    });

    const project = ownerProject();
    expect(project.status).toBe("renders_pending");
    expect(project.scan_method).toBe("lidar");
    expect(project.scan_source).toBe("roomplan");
  });

  it("labels the walls N/E/S/W by their position in the room", async () => {
    signIn({ id: OWNER });

    const payload = await (await POST(uploadJson(capturedRoom()))).json();
    const byId = Object.fromEntries(
      payload.dimensions.walls.map((wall: { id: string; length: number }) => [
        wall.id,
        wall.length,
      ]),
    );

    expect(byId).toEqual({ N: 4.2, E: 3.4, S: 4.2, W: 3.4 });
  });

  it("attaches a door to the wall it sits in", async () => {
    signIn({ id: OWNER });

    const payload = await (
      await POST(
        uploadJson(
          capturedRoom({
            doors: [
              surface({ length: 0.9, height: 2.1, cx: 2.1, cz: 0.6, alongX: false }),
            ],
          }),
        ),
      )
    ).json();

    const walls: Array<{ id: string; doors: unknown[] }> = payload.dimensions.walls;
    expect(walls.find((wall) => wall.id === "E")!.doors).toHaveLength(1);
    expect(walls.filter((wall) => wall.doors.length > 0)).toHaveLength(1);
  });

  it("rejects a file that is not JSON", async () => {
    signIn({ id: OWNER });

    const response = await POST(upload("this is not json at all"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("geldige JSON");
    expect(ownerProject().room_dimensions).toBeUndefined();
  });

  it("rejects JSON with no walls array", async () => {
    signIn({ id: OWNER });

    const response = await POST(uploadJson({ doors: [], windows: [] }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("geen muren");
  });

  it("rejects an empty walls array", async () => {
    signIn({ id: OWNER });

    expect((await POST(uploadJson({ walls: [] }))).status).toBe(400);
  });

  it("rejects a top-level JSON array", async () => {
    signIn({ id: OWNER });

    expect((await POST(uploadJson([{ walls: [] }]))).status).toBe(400);
  });

  it("rejects a request with no file", async () => {
    signIn({ id: OWNER });

    const form = new FormData();
    form.append("projectId", OWNER_PROJECT);

    const response = await POST(
      new Request("http://localhost/api/scan/roomplan-upload", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an empty file", async () => {
    signIn({ id: OWNER });

    expect((await POST(upload(""))).status).toBe(400);
  });

  it("rejects a request with no projectId", async () => {
    signIn({ id: OWNER });

    expect((await POST(upload(JSON.stringify(capturedRoom()), null))).status).toBe(400);
  });

  it("rejects a scan that never closed (a whole axis missing)", async () => {
    signIn({ id: OWNER });

    const oneWall = {
      walls: [surface({ length: 4.2, height: 2.6, cx: 0, cz: 0, alongX: true })],
    };
    const response = await POST(uploadJson(oneWall));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("gesloten ruimte");
  });

  it("rejects an oversized upload from Content-Length, before buffering it", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      new Request("http://localhost/api/scan/roomplan-upload", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          "content-length": String(50 * 1024 * 1024),
        },
        body: "--x--",
      }),
    );

    expect(response.status).toBe(413);
  });

  it("rejects an oversized file whose Content-Length understated it", async () => {
    signIn({ id: OWNER });

    const oversized = new Blob(["x".repeat(11 * 1024 * 1024)]);
    const response = await POST(upload(oversized));

    expect(response.status).toBe(413);
  });

  it("stores no script content from a malicious but well-formed Room.json", async () => {
    signIn({ id: OWNER });

    const response = await POST(
      uploadJson(
        capturedRoom({
          // Extra attacker-chosen keys alongside a valid geometry payload.
          note: "<script>alert(1)</script>",
          walls: [
            {
              ...surface({ length: 4.2, height: 2.6, cx: 0, cz: -1.7, alongX: true }),
              label: "<img src=x onerror=alert(1)>",
              evil: { __proto__: { polluted: true } },
            },
            surface({ length: 3.4, height: 2.6, cx: 2.1, cz: 0, alongX: false }),
            surface({ length: 4.2, height: 2.6, cx: 0, cz: 1.7, alongX: true }),
            surface({ length: 3.4, height: 2.6, cx: -2.1, cz: 0, alongX: false }),
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);

    // parseCapturedRoom rebuilds every wall from scratch, so only the five known
    // keys survive and the label is ours, not the file's.
    const stored = JSON.stringify(ownerProject().room_dimensions);
    expect(stored).not.toContain("<script>");
    expect(stored).not.toContain("onerror");
    expect(stored).not.toContain("polluted");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const dimensions = ownerProject().room_dimensions as {
      walls: Array<Record<string, unknown>>;
    };
    expect(Object.keys(dimensions.walls[0]).sort()).toEqual([
      "doors",
      "height",
      "id",
      "label",
      "length",
      "windows",
    ]);
    expect(dimensions.walls[0].label).toBe("Noord");
  });

  it("rejects an unauthenticated caller with 401", async () => {
    signIn(null);

    expect((await POST(uploadJson(capturedRoom()))).status).toBe(401);
  });

  it("rejects a contractor with 403", async () => {
    signIn({ id: CONTRACTOR });

    expect((await POST(uploadJson(capturedRoom()))).status).toBe(403);
  });

  it("does not write to another user's project", async () => {
    signIn({ id: ATTACKER });

    const response = await POST(uploadJson(capturedRoom()));

    expect(response.status).toBe(404);
    expect(ownerProject().room_dimensions).toBeUndefined();
    expect(ownerProject().status).toBe("draft");
  });

  it("checks ownership before using the elevated service-role client", async () => {
    // The service key bypasses RLS entirely, so the ownership check must gate it.
    // If it did not, a cross-user upload would land on the victim's row here.
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    signIn({ id: ATTACKER });

    const response = await POST(uploadJson(capturedRoom()));

    expect(response.status).toBe(404);
    expect(ownerProject().room_dimensions).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("does not resurrect a soft-deleted project", async () => {
    signIn({ id: OWNER });
    ownerProject().deleted_at = "2026-07-01T00:00:00Z";

    expect((await POST(uploadJson(capturedRoom()))).status).toBe(404);
  });

  it("returns 500 when the write fails", async () => {
    signIn({ id: OWNER });
    db.failNextWrite = { message: "write failed" };

    expect((await POST(uploadJson(capturedRoom()))).status).toBe(500);
  });
});

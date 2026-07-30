import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import {
  activeSession,
  createMockSupabase,
  resetDatabase,
  signIn,
  testUuid,
  type MockDatabase,
} from "../helpers/supabase-mock";

/**
 * PROJECT DETAIL — OWNERSHIP IS THE POINT
 *
 * This is the first page in the product that renders one specific homeowner's
 * measurements from a URL the user controls. The id is guessable in the sense
 * that it is guessable at all, so the interesting tests here are the ones where
 * a signed-in homeowner asks for someone else's project id.
 *
 * The mock Supabase enforces NO row-level security (see helpers/supabase-mock.ts),
 * so a passing isolation test proves the PAGE isolates on its own rather than
 * proving the mock refused. RLS in Postgres remains the real boundary.
 */

const requireRole = vi.fn();

class NotFound extends Error {
  constructor() {
    super("notFound()");
  }
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound();
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: (role: string) => requireRole(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(activeSession.db, activeSession.user),
}));

const { default: ProjectDetailPage } = await import(
  "@/app/(homeowner)/homeowner/project/[id]/page"
);

const HOMEOWNER = testUuid(1);
const ATTACKER = testUuid(2);
const PROJECT = testUuid(50);

let db: MockDatabase;

function asUser(id: string) {
  const user = { id, email: "hanane@example.nl", user_metadata: { role: "homeowner" } };
  signIn(user);
  requireRole.mockResolvedValue({ user: user as unknown as User, role: "homeowner" });
}

function scan() {
  return {
    source: "manual_entry",
    accuracy: "±0.5-2 cm",
    scanMethod: "manual",
    dimensions: { width: 4.2, depth: 3.4, height: 2.6, area: 14.28, perimeter: 15.2 },
    walls: [
      { id: "N", label: "Noord", length: 4.2, height: 2.6, doors: [], windows: [] },
      { id: "E", label: "Oost", length: 3.4, height: 2.6, doors: [], windows: [] },
      { id: "S", label: "Zuid", length: 4.2, height: 2.6, doors: [], windows: [] },
      { id: "W", label: "West", length: 3.4, height: 2.6, doors: [], windows: [] },
    ],
  };
}

function seedProject(overrides: Record<string, unknown> = {}) {
  db.seed("projects", [
    {
      id: PROJECT,
      homeowner_id: HOMEOWNER,
      title: null,
      status: "draft",
      renovation_type: "kitchen",
      postcode: "1011AB",
      country: "NL",
      scan_method: null,
      scan_source: null,
      magicplan_project_id: null,
      room_dimensions: null,
      created_at: "2026-07-01T10:00:00Z",
      deleted_at: null,
      ...overrides,
    },
  ]);
}

async function renderPage(id: string = PROJECT) {
  return render(await ProjectDetailPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  db = resetDatabase();
  requireRole.mockReset();
  asUser(HOMEOWNER);
});

describe("project detail — access control", () => {
  it("gates on the homeowner role", async () => {
    seedProject();

    await renderPage();

    expect(requireRole).toHaveBeenCalledWith("homeowner");
  });

  it("404s another homeowner's project rather than rendering it", async () => {
    seedProject({ title: "Keuken van iemand anders" });
    asUser(ATTACKER);

    await expect(renderPage()).rejects.toThrow(NotFound);
  });

  it("leaks nothing about a project it refuses to show", async () => {
    // A 403 would confirm the id exists. notFound() does not.
    seedProject();
    asUser(ATTACKER);

    await expect(renderPage()).rejects.toThrow(NotFound);
    expect(screen.queryByText(/1011AB/)).not.toBeInTheDocument();
  });

  it("404s an id that is not a uuid, before it reaches Postgres", async () => {
    await expect(renderPage("not-a-uuid")).rejects.toThrow(NotFound);
    await expect(renderPage("../../etc/passwd")).rejects.toThrow(NotFound);
  });

  it("404s a project id that does not exist", async () => {
    await expect(renderPage(testUuid(999))).rejects.toThrow(NotFound);
  });

  it("404s a soft-deleted project", async () => {
    seedProject({ deleted_at: "2026-07-10T00:00:00Z" });

    await expect(renderPage()).rejects.toThrow(NotFound);
  });

  it("does not pretend a failed query is a missing project", async () => {
    seedProject();
    db.failNextRead = { message: "connection terminated" };

    // "This project does not exist" to the owner of a project that does is
    // worse than an error page — error.tsx offers a retry.
    const error = await renderPage().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFound);
  });
});

describe("project detail — an unscanned project", () => {
  beforeEach(() => {
    seedProject();
  });

  it("falls back to the room type for the heading", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Keuken");
  });

  it("shows status, postcode and country", async () => {
    await renderPage();

    expect(screen.getByText(/Concept · 1011AB · NL/)).toBeInTheDocument();
  });

  it("reports that nothing has been measured yet", async () => {
    await renderPage();

    expect(screen.getByText("Nog geen afmetingen")).toBeInTheDocument();
    expect(screen.getByText("Nog niet gescand")).toBeInTheDocument();
  });

  it("links the scan CTA to THIS project, not to a new one", async () => {
    await renderPage();

    // Without the ?projectId= the wizard creates a second project row and the
    // scan never attaches to the project the homeowner opened.
    expect(screen.getByRole("link", { name: /Ruimte scannen/ })).toHaveAttribute(
      "href",
      `/homeowner/project/new?projectId=${PROJECT}`,
    );
  });

  it("links back to the dashboard", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: "Terug naar dashboard" })).toHaveAttribute(
      "href",
      "/homeowner/dashboard",
    );
  });

  it("lists the next steps with the unbuilt ones marked 'Binnenkort'", async () => {
    await renderPage();

    expect(screen.getByText("Ruimte opmeten")).toBeInTheDocument();
    expect(screen.getByText("Plattegrond genereren")).toBeInTheDocument();
    expect(screen.getAllByText("Binnenkort").length).toBe(2);
  });
});

describe("project detail — a scanned project", () => {
  beforeEach(() => {
    seedProject({
      title: "Keuken achterhuis",
      status: "renders_pending",
      scan_method: "manual",
      scan_source: "manual_entry",
      room_dimensions: scan(),
    });
  });

  it("shows the measured dimensions", async () => {
    await renderPage();

    expect(screen.getByText("4.20 m")).toBeInTheDocument();
    expect(screen.getByText("3.40 m")).toBeInTheDocument();
    expect(screen.getByText("2.60 m")).toBeInTheDocument();
    expect(screen.getByText("14.28 m²")).toBeInTheDocument();
    expect(screen.getByText("15.20 m")).toBeInTheDocument();
  });

  it("badges the scan method and its source", async () => {
    await renderPage();

    expect(screen.getByText("Handmatig gemeten")).toBeInTheDocument();
    expect(screen.getByText("Handmatige invoer")).toBeInTheDocument();
  });

  it("reports the accuracy the measurement claims", async () => {
    await renderPage();

    expect(screen.getByText("±0.5-2 cm")).toBeInTheDocument();
  });

  it("lists all four walls", async () => {
    await renderPage();

    for (const label of ["Noord", "Oost", "Zuid", "West"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("draws the floor plan diagram", async () => {
    const { container } = await renderPage();

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the next step as coming soon rather than 404-ing", async () => {
    await renderPage();

    const next = screen.getByRole("button", { name: /Plattegrond bekijken/ });

    expect(next).toBeDisabled();
    expect(screen.getByText(/Binnenkort beschikbaar/)).toBeInTheDocument();
  });

  it("flags mock data so test scans are never mistaken for real ones", async () => {
    db = resetDatabase();
    asUser(HOMEOWNER);
    seedProject({
      scan_method: "lidar",
      scan_source: "magicplan_mock",
      magicplan_project_id: "mock-123",
      room_dimensions: { ...scan(), source: "mock" },
    });

    await renderPage();

    // Twice over: a banner above the measurements, and the "Bron" fact naming
    // the mock import id.
    expect(screen.getByText(/Testdata — geïmporteerd zonder magicplan/)).toBeInTheDocument();
    expect(screen.getByText("Testdata · mock-123")).toBeInTheDocument();
    expect(screen.getByText("LiDAR")).toBeInTheDocument();
  });
});

describe("project detail — a malformed room_dimensions row", () => {
  it.each([
    ["a bare string", "not an object"],
    ["no walls", { dimensions: { width: 1, depth: 1, height: 1, area: 1, perimeter: 1 } }],
    ["walls but no dimensions", { walls: [{ id: "N", length: 4, height: 2.6 }] }],
    [
      "a non-numeric dimension",
      {
        walls: [{ id: "N", label: "Noord", length: 4, height: 2.6, doors: [], windows: [] }],
        dimensions: { width: "4.2", depth: 3.4, height: 2.6, area: 14.28, perimeter: 15.2 },
      },
    ],
  ])("renders the 'not measured yet' state for %s", async (_label, room_dimensions) => {
    seedProject({ room_dimensions });

    await renderPage();

    // A malformed row must not crash the page the homeowner lands on after a scan.
    expect(screen.getByText("Nog geen afmetingen")).toBeInTheDocument();
  });
});

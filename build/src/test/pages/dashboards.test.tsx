import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { renderWithIntl as render } from "../helpers/intl";
import {
  activeSession,
  createMockSupabase,
  resetDatabase,
  signIn,
  testUuid,
  type MockDatabase,
} from "../helpers/supabase-mock";

/**
 * THE FIVE ROLE DASHBOARDS
 *
 * Each is an async Server Component. Testing-library cannot render an async
 * component as JSX, so these tests await the page function and render what it
 * returns — the same thing React does on the server.
 *
 * `RoleDashboard` is stubbed because it is itself async and would sit inside the
 * returned tree, where the client renderer cannot resolve it. The stub keeps the
 * props visible so "which account am I looking at" is still asserted here; the
 * component's own rendering is covered by NavBar.test.tsx, which shares its
 * translation keys.
 *
 * The Dutch strings asserted below now come from `messages/nl.json` (F17), so
 * these tests double as the check that the dashboard namespace is complete —
 * a missing key throws rather than rendering blank.
 */

const requireRole = vi.fn();

vi.mock("next-intl/server", async () => {
  const { serverIntlMock } = await import("../helpers/intl");
  return serverIntlMock();
});

vi.mock("@/lib/auth", () => ({
  requireRole: (role: string) => requireRole(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(activeSession.db, activeSession.user),
}));

vi.mock("@/components/role-dashboard", () => ({
  RoleDashboard: ({ role, email }: { role: string; email?: string }) => (
    <div data-testid="role-dashboard" data-role={role}>
      Welkom{email ? `, ${email}` : ""}
    </div>
  ),
}));

const { default: HomeownerDashboard } = await import(
  "@/app/(homeowner)/homeowner/dashboard/page"
);
const { default: ContractorDashboard } = await import(
  "@/app/(contractor)/contractor/dashboard/page"
);
const { default: DesignerDashboard } = await import(
  "@/app/(designer)/designer/dashboard/page"
);

const HOMEOWNER = testUuid(1);
const OTHER_HOMEOWNER = testUuid(2);

let db: MockDatabase;

function asUser(id: string, role: string) {
  const user = {
    id,
    email: "hanane@example.nl",
    user_metadata: { role },
  };
  signIn(user);
  requireRole.mockResolvedValue({ user: user as unknown as User, role });
}

function seedProject(overrides: Record<string, unknown> = {}) {
  db.seed("projects", [
    {
      id: testUuid(),
      homeowner_id: HOMEOWNER,
      title: null,
      status: "draft",
      renovation_type: "kitchen",
      scan_method: null,
      created_at: "2026-07-01T10:00:00Z",
      deleted_at: null,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  db = resetDatabase();
  requireRole.mockReset();
});

describe("homeowner dashboard", () => {
  beforeEach(() => {
    asUser(HOMEOWNER, "homeowner");
  });

  it("gates on the homeowner role", async () => {
    render(await HomeownerDashboard());

    expect(requireRole).toHaveBeenCalledWith("homeowner");
  });

  it("greets the signed-in account", async () => {
    render(await HomeownerDashboard());

    expect(screen.getByTestId("role-dashboard")).toHaveTextContent(
      "Welkom, hanane@example.nl",
    );
  });

  describe("with no projects", () => {
    it("shows the empty state instead of an empty list", async () => {
      render(await HomeownerDashboard());

      expect(screen.getByText("Nog geen projecten")).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("offers exactly one way forward, into the scan flow", async () => {
      render(await HomeownerDashboard());

      const ctas = screen.getAllByRole("link", { name: "Nieuw project starten" });

      expect(ctas).toHaveLength(1);
      expect(ctas[0]).toHaveAttribute("href", "/homeowner/project/new");
    });
  });

  describe("with projects", () => {
    it("lists them as links to the project detail page", async () => {
      const id = testUuid(50);
      seedProject({ id, renovation_type: "bathroom" });

      render(await HomeownerDashboard());

      expect(screen.getByRole("link", { name: /Badkamer|Verbouwing|Bekijk project/ })).toHaveAttribute(
        "href",
        `/homeowner/project/${id}`,
      );
    });

    it("shows the room type, status badge and date on the card", async () => {
      seedProject({ status: "renders_pending", created_at: "2026-07-01T10:00:00Z" });

      render(await HomeownerDashboard());

      expect(screen.getByText("Plattegrond klaar")).toBeInTheDocument();
      expect(screen.getByText(/1 jul 2026/)).toBeInTheDocument();
    });

    it("prefers the project title when one is set", async () => {
      seedProject({ title: "Keuken achterhuis" });

      render(await HomeownerDashboard());

      expect(screen.getByText("Keuken achterhuis")).toBeInTheDocument();
    });

    it("names the scan method once a room has been measured", async () => {
      seedProject({ scan_method: "lidar" });

      render(await HomeownerDashboard());

      expect(screen.getByText(/LiDAR/)).toBeInTheDocument();
    });

    it("renders an unknown status as-is rather than blank", async () => {
      seedProject({ status: "some_future_status" });

      render(await HomeownerDashboard());

      expect(screen.getByText("some_future_status")).toBeInTheDocument();
    });

    it("survives a project with no renovation type or date", async () => {
      seedProject({ renovation_type: null, created_at: null });

      render(await HomeownerDashboard());

      expect(screen.getByText("Verbouwing")).toBeInTheDocument();
      expect(screen.getByText(/—/)).toBeInTheDocument();
    });

    it("keeps the 'new project' button available", async () => {
      seedProject();

      render(await HomeownerDashboard());

      expect(screen.getByRole("link", { name: "Nieuw project starten" })).toHaveAttribute(
        "href",
        "/homeowner/project/new",
      );
    });

    it("does not show another homeowner's projects", async () => {
      seedProject({ title: "Mijn keuken" });
      db.seed("projects", [
        {
          id: testUuid(),
          homeowner_id: OTHER_HOMEOWNER,
          title: "Andermans badkamer",
          status: "draft",
          renovation_type: "bathroom",
          scan_method: null,
          created_at: "2026-07-02T10:00:00Z",
          deleted_at: null,
        },
      ]);

      render(await HomeownerDashboard());

      expect(screen.getByText("Mijn keuken")).toBeInTheDocument();
      expect(screen.queryByText("Andermans badkamer")).not.toBeInTheDocument();
    });

    it("hides soft-deleted projects", async () => {
      seedProject({ title: "Verwijderd", deleted_at: "2026-07-10T00:00:00Z" });

      render(await HomeownerDashboard());

      expect(screen.queryByText("Verwijderd")).not.toBeInTheDocument();
      expect(screen.getByText("Nog geen projecten")).toBeInTheDocument();
    });
  });

  describe("when the query fails", () => {
    it("says so instead of claiming the homeowner has no projects", async () => {
      seedProject({ title: "Keuken achterhuis" });
      db.failNextRead = { message: "connection terminated" };

      render(await HomeownerDashboard());

      // The bug this guards: an ignored `error` field renders the empty state,
      // so a homeowner with three projects is told they have none and starts
      // scanning the same room again.
      expect(screen.queryByText("Nog geen projecten")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        /projecten zijn niet verdwenen/,
      );
    });

    it("still offers a way forward", async () => {
      db.failNextRead = { message: "statement timeout" };

      render(await HomeownerDashboard());

      expect(screen.getByRole("link", { name: "Nieuw project starten" })).toBeInTheDocument();
    });
  });
});

describe("contractor dashboard", () => {
  beforeEach(() => {
    asUser(testUuid(3), "contractor");
  });

  it("gates on the contractor role", async () => {
    render(await ContractorDashboard());

    expect(requireRole).toHaveBeenCalledWith("contractor");
  });

  it("welcomes the signed-in contractor", async () => {
    render(await ContractorDashboard());

    expect(screen.getByTestId("role-dashboard")).toHaveTextContent("Welkom");
    expect(screen.getByTestId("role-dashboard")).toHaveAttribute("data-role", "contractor");
  });

  it("shows an honest empty lead list, not seeded fake leads", async () => {
    render(await ContractorDashboard());

    expect(screen.getByText("Geen leads beschikbaar")).toBeInTheDocument();
  });

  it("states the €35 lead fee up front", async () => {
    render(await ContractorDashboard());

    expect(screen.getByText(/€35 per lead/)).toBeInTheDocument();
  });

  it("has no dead links while F09 is unbuilt", async () => {
    render(await ContractorDashboard());

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("designer dashboard", () => {
  beforeEach(() => {
    asUser(testUuid(4), "interior_designer");
  });

  it("gates on the interior_designer role", async () => {
    render(await DesignerDashboard());

    expect(requireRole).toHaveBeenCalledWith("interior_designer");
  });

  it("welcomes the signed-in designer", async () => {
    render(await DesignerDashboard());

    expect(screen.getByTestId("role-dashboard")).toHaveAttribute(
      "data-role",
      "interior_designer",
    );
  });

  it("shows an empty assignment list", async () => {
    render(await DesignerDashboard());

    expect(screen.getByText("Geen opdrachten beschikbaar")).toBeInTheDocument();
  });

  it("states the €25 designer lead fee", async () => {
    render(await DesignerDashboard());

    expect(screen.getByText(/€25 per lead/)).toBeInTheDocument();
  });
});

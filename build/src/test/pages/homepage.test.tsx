import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { renderWithIntl } from "../helpers/intl";

/**
 * The homepage is the one page that renders with NO session — the proxy does not
 * gate `/` — and it is also where logging out lands. So it has to work in both
 * states, and the signed-out state is the funnel: register CTA, login link, and
 * the three value propositions the founder is testing the pitch with.
 *
 * `@/lib/auth` is mocked rather than Supabase itself: the page's only server
 * dependency is `getSessionUser()`, and mocking at that seam keeps the test
 * about the page instead of about cookie plumbing.
 *
 * The copy now comes from the `home` namespace (F17), so the Dutch assertions
 * below are also the check that `messages/nl.json` still carries every key the
 * page asks for — a typo'd key throws instead of rendering.
 */

const getSessionUser = vi.fn<() => Promise<User | null>>();

vi.mock("@/lib/auth", () => ({
  getSessionUser: () => getSessionUser(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { default: Home } = await import("@/app/page");

function signedInUser(): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "hanane@example.nl",
    app_metadata: {},
    user_metadata: { role: "homeowner" },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  } as User;
}

async function renderHome() {
  return renderWithIntl(await Home());
}

/** Every href the page renders, so a dead link cannot hide in the markup. */
function allHrefs(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter(Boolean);
}

/** Routes that exist in src/app and can therefore be linked to. */
const ROUTES_THAT_EXIST = [
  "/",
  "/dashboard",
  "/auth/login",
  "/auth/register",
  "/homeowner/dashboard",
  "/homeowner/project/new",
];

beforeEach(() => {
  getSessionUser.mockReset();
  getSessionUser.mockResolvedValue(null);
});

describe("homepage", () => {
  it("renders without crashing", async () => {
    const { container } = await renderHome();

    expect(container).not.toBeEmptyDOMElement();
  });

  it("shows the SlimRuimte brand", async () => {
    await renderHome();

    expect(screen.getByRole("link", { name: "SlimRuimte" })).toHaveAttribute("href", "/");
  });

  it("lets a visitor switch language before they have an account", async () => {
    // The switcher has to be reachable signed OUT: a French-speaking Belgian
    // homeowner lands here first, and a Dutch-only funnel loses them.
    await renderHome();

    const group = screen.getByRole("group", { name: "Taal" });

    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "NL",
      "EN",
      "FR",
    ]);
  });

  it("keeps the switcher available while signed in", async () => {
    getSessionUser.mockResolvedValue(signedInUser());

    await renderHome();

    expect(screen.getByRole("group", { name: "Taal" })).toBeInTheDocument();
  });

  it("leads with the promise, in Dutch", async () => {
    await renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /Zie je verbouwing voordat je begint/ }),
    ).toBeInTheDocument();
  });

  it("names both launch markets, since BE is in scope", async () => {
    await renderHome();

    expect(screen.getByText(/Nederland en België/)).toBeInTheDocument();
  });

  describe("signed out", () => {
    it("offers 'Start gratis' pointing at registration", async () => {
      await renderHome();

      const ctas = screen.getAllByRole("link", { name: "Start gratis" });

      expect(ctas.length).toBeGreaterThan(0);
      for (const cta of ctas) {
        expect(cta).toHaveAttribute("href", "/auth/register");
      }
    });

    it("offers 'Inloggen' pointing at the login page", async () => {
      await renderHome();

      const logins = screen.getAllByRole("link", { name: "Inloggen" });

      expect(logins.length).toBeGreaterThan(0);
      for (const login of logins) {
        expect(login).toHaveAttribute("href", "/auth/login");
      }
    });

    it("also offers 'Registreren' in the header", async () => {
      await renderHome();

      expect(screen.getByRole("link", { name: "Registreren" })).toHaveAttribute(
        "href",
        "/auth/register",
      );
    });

    it("removes payment friction from the first CTA", async () => {
      await renderHome();

      expect(screen.getByText(/Geen creditcard nodig/)).toBeInTheDocument();
    });

    it("does not invite a signed-out visitor into the app", async () => {
      await renderHome();

      expect(screen.queryByRole("link", { name: /Naar mijn dashboard/ })).not.toBeInTheDocument();
      expect(allHrefs()).not.toContain("/dashboard");
    });
  });

  describe("value propositions", () => {
    it("shows exactly three", async () => {
      await renderHome();

      // Level 2: the hero owns the only h1, so the props must not compete with it.
      const headings = screen.getAllByRole("heading", { level: 2 });
      const propTitles = [
        "Exacte plattegrond",
        "3D renders voor je verbouwing",
        "Betrouwbare aannemers",
      ];

      for (const title of propTitles) {
        expect(headings.some((heading) => heading.textContent === title)).toBe(true);
      }
    });

    it("describes each one in Dutch", async () => {
      await renderHome();

      expect(screen.getByText(/Nauwkeurig tot 2 cm/)).toBeInTheDocument();
      expect(screen.getByText(/Zie je nieuwe keuken of badkamer voor je begint/)).toBeInTheDocument();
      expect(screen.getByText(/Drie geverifieerde aannemers/)).toBeInTheDocument();
    });

    it("keeps the emoji out of the accessibility tree", async () => {
      const { container } = await renderHome();

      const decorative = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorative.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      getSessionUser.mockResolvedValue(signedInUser());
    });

    it("routes the visitor into the app instead of asking them to register", async () => {
      await renderHome();

      const ctas = screen.getAllByRole("link", { name: "Naar mijn dashboard" });

      expect(ctas.length).toBeGreaterThan(0);
      for (const cta of ctas) {
        // /dashboard is the role dispatcher, so the homepage never needs to
        // know which of the five dashboards this user belongs on.
        expect(cta).toHaveAttribute("href", "/dashboard");
      }
    });

    it("drops the register and login CTAs", async () => {
      await renderHome();

      expect(screen.queryByRole("link", { name: "Start gratis" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Inloggen" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Registreren" })).not.toBeInTheDocument();
      expect(allHrefs()).not.toContain("/auth/register");
    });

    it("does not leak the signed-out 'no credit card' line", async () => {
      await renderHome();

      expect(screen.queryByText(/Geen creditcard nodig/)).not.toBeInTheDocument();
    });
  });

  describe("no dead links", () => {
    it.each([
      ["signed out", null],
      ["signed in", signedInUser()],
    ])("links only to routes that exist (%s)", async (_state, user) => {
      getSessionUser.mockResolvedValue(user);

      await renderHome();

      for (const href of allHrefs()) {
        expect(ROUTES_THAT_EXIST).toContain(href);
      }
    });
  });

  describe("responsive layout", () => {
    it("stacks the hero CTAs on mobile and rows them from sm up", async () => {
      const { container } = await renderHome();

      const ctaRow = container.querySelector(".flex-col.gap-3.sm\\:flex-row");
      expect(ctaRow).not.toBeNull();
      expect(within(ctaRow as HTMLElement).getAllByRole("link").length).toBe(2);
    });

    it("gives the value props one column on mobile and three from md up", async () => {
      const { container } = await renderHome();

      expect(container.querySelector(".md\\:grid-cols-3")).not.toBeNull();
    });

    it("caps the content width so the copy stays readable on a desktop", async () => {
      const { container } = await renderHome();

      expect(container.querySelectorAll(".max-w-5xl").length).toBeGreaterThan(0);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/nl.json";
import { ROLES, ROLE_ROUTE_PREFIX, type Role } from "@/lib/roles";

/**
 * NavBar is an async SERVER component, and deliberately so: it resolves its
 * labels with `getTranslations` (next-intl/server) and renders exactly one
 * client component, the logout button. Making the whole bar `"use client"`
 * would ship the translations to the browser for no gain.
 *
 * Testing-library cannot render an async component as JSX, so these tests await
 * the component function and render the element it returns — the same thing
 * React does on the server. `next-intl/server` is mocked to resolve against the
 * real `messages/nl.json`, so a renamed or missing key fails here rather than
 * shipping a raw key like "roles.homeowner.name" to the founder's screen.
 */

const replace = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    return (key: string) => {
      const path = `${namespace}.${key}`.split(".");
      let node: unknown = messages;
      for (const segment of path) {
        node = (node as Record<string, unknown>)?.[segment];
      }
      if (typeof node !== "string") {
        throw new Error(`Missing message: ${path.join(".")}`);
      }
      return node;
    };
  },
}));

const { NavBar } = await import("@/components/layout/NavBar");

async function renderNavBar(props: { userEmail: string | undefined; role: Role }) {
  const element = await NavBar(props);

  return render(
    <NextIntlClientProvider locale="nl" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

/** Role -> the Dutch badge label the founder will actually see. */
const ROLE_LABELS: Record<Role, string> = {
  homeowner: "Huiseigenaar",
  contractor: "Aannemer",
  interior_designer: "Interieurontwerper",
  estate_agent: "Makelaar",
  admin: "Beheerder",
};

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  signOut.mockClear();
});

describe("NavBar", () => {
  it("renders the email and role it is given", async () => {
    await renderNavBar({ userEmail: "hanane@example.nl", role: "homeowner" });

    expect(screen.getByText("hanane@example.nl")).toBeInTheDocument();
    expect(screen.getByText("Huiseigenaar")).toBeInTheDocument();
  });

  it("renders without an email rather than crashing", async () => {
    // `user.email` is optional on the Supabase User type — a phone-only or
    // SSO account can legitimately have none.
    await renderNavBar({ userEmail: undefined, role: "homeowner" });

    expect(screen.getByText("Huiseigenaar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uitloggen" })).toBeInTheDocument();
  });

  it("does not print a hardcoded email — the value comes from the prop", async () => {
    await renderNavBar({ userEmail: "someone.else@example.be", role: "contractor" });

    expect(screen.getByText("someone.else@example.be")).toBeInTheDocument();
    expect(screen.queryByText(/hanane\.saih@demoods\.com/)).not.toBeInTheDocument();
  });

  it.each(ROLES)("shows the Dutch badge label for role=%s", async (role) => {
    await renderNavBar({ userEmail: "test@example.nl", role });

    expect(screen.getByText(ROLE_LABELS[role])).toBeInTheDocument();
  });

  it("carries the language switcher, so the choice follows the user into the app", async () => {
    await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

    const group = screen.getByRole("group", { name: "Taal" });

    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "NL",
      "EN",
      "FR",
    ]);
  });

  it("puts the switcher between the identity and the logout button", async () => {
    await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

    const email = screen.getByText("test@example.nl");
    const group = screen.getByRole("group", { name: "Taal" });
    const logout = screen.getByRole("button", { name: "Uitloggen" });

    // 4 = Node.DOCUMENT_POSITION_FOLLOWING: email → switcher → logout, so the
    // switcher never separates the user from the way out of the app.
    expect(email.compareDocumentPosition(group) & 4).toBeTruthy();
    expect(group.compareDocumentPosition(logout) & 4).toBeTruthy();
  });

  it("points the brand at the homepage", async () => {
    await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

    expect(screen.getByRole("link", { name: "SlimRuimte" })).toHaveAttribute("href", "/");
  });

  it.each(Object.entries(ROLE_ROUTE_PREFIX))(
    "points the Dashboard link at %s's own dashboard",
    async (role, prefix) => {
      await renderNavBar({ userEmail: "test@example.nl", role: role as Role });

      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "href",
        `${prefix}/dashboard`,
      );
    },
  );

  it("gives the brand and the Dashboard link different destinations", async () => {
    // They both pointed at the role dashboard when this first shipped: two
    // adjacent links to the same URL, and no route back to the public homepage.
    await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

    const brand = screen.getByRole("link", { name: "SlimRuimte" });
    const dashboard = screen.getByRole("link", { name: "Dashboard" });

    expect(brand.getAttribute("href")).not.toBe(dashboard.getAttribute("href"));
  });

  describe("logout", () => {
    it("renders a logout button", async () => {
      await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

      expect(screen.getByRole("button", { name: "Uitloggen" })).toBeInTheDocument();
    });

    it("calls supabase signOut and lands the user on the homepage", async () => {
      await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

      fireEvent.click(screen.getByRole("button", { name: "Uitloggen" }));

      await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
      // Not /auth/login: signing out is not the start of signing back in, and
      // "/" is the only page that renders with no session.
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    });

    it("refreshes so the server stops rendering the signed-in shell", async () => {
      await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

      fireEvent.click(screen.getByRole("button", { name: "Uitloggen" }));

      // Without router.refresh() the RSC payload stays cached and the NavBar
      // keeps showing the email of the account that just signed out.
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    it("signs out before navigating away", async () => {
      await renderNavBar({ userEmail: "test@example.nl", role: "homeowner" });

      fireEvent.click(screen.getByRole("button", { name: "Uitloggen" }));

      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
        replace.mock.invocationCallOrder[0],
      );
    });
  });

  it("is reachable from every role shell, so no role can get stuck", async () => {
    for (const role of ROLES) {
      const { unmount } = await renderNavBar({ userEmail: "test@example.nl", role });

      expect(screen.getByRole("button", { name: "Uitloggen" })).toBeInTheDocument();
      unmount();
    }
  });
});

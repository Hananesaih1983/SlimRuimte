import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/intl";
import { LOCALES } from "@/i18n/config";

/**
 * LANGUAGE SWITCHER (F17)
 *
 * The locale is not in the URL — it lives in the `NEXT_LOCALE` cookie that
 * src/i18n/request.ts reads on every request. So the switcher has exactly two
 * jobs: write that cookie, and ask the router to re-render the Server
 * Components. If either half is missing the user clicks "EN" and nothing
 * happens, or the page turns English and reverts on the next navigation.
 */

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const { LanguageSwitcher } = await import("@/components/layout/LanguageSwitcher");

/** Captures writes to document.cookie; jsdom would otherwise swallow the flags. */
const writeCookie = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  writeCookie.mockReset();
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "",
    set: writeCookie,
  });
});

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).cookie;
});

describe("LanguageSwitcher", () => {
  it("offers all three supported languages", () => {
    renderWithIntl(<LanguageSwitcher />);

    for (const locale of LOCALES) {
      expect(
        screen.getByRole("button", { name: locale.toUpperCase() }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(LOCALES.length);
  });

  it("marks the active language and only that one", () => {
    renderWithIntl(<LanguageSwitcher />, "fr");

    expect(screen.getByRole("button", { name: "FR" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "NL" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: "EN" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("names each language in its own language, not the current one", () => {
    // A French visitor looking for their language scans for "Français", not for
    // the Dutch word for French.
    renderWithIntl(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute(
      "title",
      "Nederlands",
    );
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
      "title",
      "English",
    );
    expect(screen.getByRole("button", { name: "FR" })).toHaveAttribute(
      "title",
      "Français",
    );
  });

  it("labels the group with the translated word for language", () => {
    renderWithIntl(<LanguageSwitcher />);

    expect(screen.getByRole("group", { name: "Taal" })).toBeInTheDocument();
  });

  it.each([
    ["EN", "en"],
    ["FR", "fr"],
  ])("writes the %s locale to the NEXT_LOCALE cookie", (label, locale) => {
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(writeCookie).toHaveBeenCalledTimes(1);
    expect(writeCookie.mock.calls[0][0]).toContain(`NEXT_LOCALE=${locale}`);
  });

  it("scopes the cookie to the whole site so every route switches", () => {
    // Without path=/ the cookie is scoped to the current path and the language
    // silently reverts as soon as the user navigates.
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(writeCookie.mock.calls[0][0]).toMatch(/path=\//);
  });

  it("persists the choice beyond the session", () => {
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    const written = writeCookie.mock.calls[0][0] as string;
    const maxAge = /max-age=(\d+)/.exec(written);

    expect(maxAge).not.toBeNull();
    // A session cookie would make a returning visitor pick their language again.
    expect(Number(maxAge?.[1])).toBeGreaterThan(60 * 60 * 24 * 30);
  });

  it("refreshes so the Server Components re-render in the new language", () => {
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    // Without this the cookie is set but the page keeps its Dutch RSC payload.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("writes the cookie before refreshing", () => {
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "FR" }));

    expect(writeCookie.mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0],
    );
  });

  it("does nothing when the active language is clicked again", () => {
    renderWithIntl(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(writeCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("switches away from a non-default active locale", () => {
    renderWithIntl(<LanguageSwitcher />, "en");

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(writeCookie.mock.calls[0][0]).toContain("NEXT_LOCALE=nl");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("only ever writes a supported locale", () => {
    renderWithIntl(<LanguageSwitcher />);

    for (const button of screen.getAllByRole("button")) {
      fireEvent.click(button);
    }

    for (const [written] of writeCookie.mock.calls) {
      const value = /NEXT_LOCALE=([a-z-]+)/.exec(written as string)?.[1];
      expect(LOCALES).toContain(value);
    }
  });
});

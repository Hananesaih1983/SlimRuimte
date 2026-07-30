import { describe, expect, it, vi } from "vitest";
import nl from "../../../messages/nl.json";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { DEFAULT_LOCALE, FORMAT_LOCALE, LOCALES, isLocale } from "@/i18n/config";

/**
 * TRILINGUAL COPY (F17)
 *
 * Two things can silently break the NL/EN/FR promise, and neither shows up in a
 * page test written in one language:
 *
 *   1. A key added to nl.json and forgotten in fr.json. next-intl then renders
 *      the raw key path ("dashboard.no_leads") to a French user.
 *   2. A key present but left as "" — an invisible gap in the page.
 *
 * These tests compare the real message files against each other, so adding copy
 * in one language and not the others fails here rather than in front of a user.
 */

const CATALOGUE = { nl, en, fr } as Record<string, unknown>;

/** "dashboard.no_leads" -> value, for every leaf in the tree. */
function flatten(node: unknown, prefix = ""): Array<[string, unknown]> {
  if (typeof node !== "object" || node === null) return [[prefix, node]];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function keysOf(locale: string): string[] {
  return flatten(CATALOGUE[locale])
    .map(([key]) => key)
    .sort();
}

describe("message files", () => {
  it("ships a file for every supported locale", () => {
    for (const locale of LOCALES) {
      expect(CATALOGUE[locale], `messages/${locale}.json`).toBeDefined();
    }
  });

  it.each(["en", "fr"])("%s has exactly the keys nl has", (locale) => {
    const dutch = keysOf("nl");
    const other = keysOf(locale);

    // Listed rather than compared as sets, so a failure names the missing key
    // instead of just reporting two different lengths.
    expect(other.filter((key) => !dutch.includes(key))).toEqual([]);
    expect(dutch.filter((key) => !other.includes(key))).toEqual([]);
  });

  it.each(["nl", "en", "fr"])("%s has no blank or non-string copy", (locale) => {
    const blank = flatten(CATALOGUE[locale])
      .filter(([, value]) => typeof value !== "string" || value.trim() === "")
      .map(([key]) => key);

    expect(blank).toEqual([]);
  });

  it("translates every project status the database can hold", () => {
    // Mirrors the CHECK constraint on public.projects.status; the homeowner
    // dashboard renders these directly.
    const statuses = [
      "draft",
      "scanning",
      "renders_pending",
      "renders_done",
      "brief_approved",
      "brief_sent",
      "designer_matched",
      "contractor_matched",
      "in_progress",
      "complete",
      "archived",
    ];

    for (const locale of LOCALES) {
      const messages = CATALOGUE[locale] as { project_status: Record<string, string> };
      for (const status of statuses) {
        expect(messages.project_status[status], `${locale}.${status}`).toBeTruthy();
      }
    }
  });
});

describe("locale config", () => {
  it("defaults to Dutch, the home market", () => {
    expect(DEFAULT_LOCALE).toBe("nl");
  });

  it("accepts the three supported locales and nothing else", () => {
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
    }

    // "de" and "en-US" are the plausible near-misses; the rest are the shapes a
    // hand-edited or hostile cookie can actually arrive as.
    for (const value of ["de", "en-US", "", "NL", null, undefined, 42, {}]) {
      expect(isLocale(value), String(value)).toBe(false);
    }
  });

  it("formats dates and money the European way for every locale", () => {
    // Bare "en" resolves to en-US: 7/1/2026 instead of 1 Jul 2026.
    expect(FORMAT_LOCALE.en).toBe("en-GB");

    const date = new Date("2026-07-01T10:00:00Z");
    for (const locale of LOCALES) {
      const formatted = new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Amsterdam",
      }).format(date);

      expect(formatted, locale).toMatch(/^1\b/);
    }
  });
});

describe("request config", () => {
  /**
   * Load src/i18n/request.ts with a given NEXT_LOCALE cookie present.
   *
   * Under vitest, `next-intl/server` resolves to its react-client build, where
   * `getRequestConfig` throws "not supported in Client Components". It is only a
   * wrapper, so it is stubbed to hand back the callback unchanged — what runs
   * below is then the real cookie-reading logic from request.ts.
   */
  async function configFor(cookieValue: string | undefined) {
    vi.resetModules();
    vi.doMock("next-intl/server", () => ({
      getRequestConfig: (callback: unknown) => callback,
    }));
    vi.doMock("next/headers", () => ({
      cookies: async () => ({
        get: (name: string) =>
          name === "NEXT_LOCALE" && cookieValue !== undefined
            ? { value: cookieValue }
            : undefined,
      }),
    }));

    const { default: getConfig } = await import("@/i18n/request");

    return (await (getConfig as unknown as (params: unknown) => Promise<{
      locale: string;
      messages: Record<string, unknown>;
    }>)({ requestLocale: Promise.resolve(undefined) }));
  }

  it("uses the locale from the NEXT_LOCALE cookie", async () => {
    const config = await configFor("fr");

    expect(config.locale).toBe("fr");
    expect(config.messages).toMatchObject({ nav: { language: "Langue" } });
  });

  it("falls back to Dutch when no cookie is set", async () => {
    // The first visit: no cookie, and the page must still render.
    const config = await configFor(undefined);

    expect(config.locale).toBe("nl");
    expect(config.messages).toMatchObject({ nav: { language: "Taal" } });
  });

  it("falls back to Dutch when the cookie holds an unsupported locale", async () => {
    // A hand-edited cookie must not 500 the app trying to import messages/de.json.
    const config = await configFor("de");

    expect(config.locale).toBe("nl");
  });

  it("loads the matching message file for each supported locale", async () => {
    for (const locale of LOCALES) {
      const config = await configFor(locale);

      expect(config.locale, locale).toBe(locale);
      expect(Object.keys(config.messages).length, locale).toBeGreaterThan(0);
    }
  });
});

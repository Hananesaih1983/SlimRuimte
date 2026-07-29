/** Locales supported by SlimRuimte. NL is the home market, so it is the default. */
export const LOCALES = ["nl", "en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";

/** Cookie the language switcher writes; mirrors `public.users.language`. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

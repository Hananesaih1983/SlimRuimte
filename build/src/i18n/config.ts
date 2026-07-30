/** Locales supported by SlimRuimte. NL is the home market, so it is the default. */
export const LOCALES = ["nl", "en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";

/** Cookie the language switcher writes; mirrors `public.users.language`. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * BCP 47 tag to format dates and numbers with, per locale.
 *
 * `en` on its own resolves to en-US (7/1/2026, $), which is wrong for a NL/BE
 * product — en-GB gives day-first dates and European conventions.
 */
export const FORMAT_LOCALE: Record<Locale, string> = {
  nl: "nl-NL",
  en: "en-GB",
  fr: "fr-FR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

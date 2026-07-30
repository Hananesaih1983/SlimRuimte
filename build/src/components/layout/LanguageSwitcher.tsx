"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * NL / EN / FR switcher.
 *
 * The locale lives in the `NEXT_LOCALE` cookie rather than the URL (see
 * src/i18n/request.ts), so switching is: write the cookie, then `router.refresh()`
 * to re-render the Server Components with the new locale. The refresh sends the
 * fresh cookie along, and `getRequestConfig` reads it — no navigation, so the
 * user stays on the page they were reading.
 *
 * The buttons show language codes, which are the same in every language. The
 * `title` gives the endonym (Nederlands / English / Français), which is what a
 * speaker of that language recognises — never the current locale's name for it.
 */

/** A year: long enough that a returning visitor keeps their choice. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const LOCALE_ENDONYM: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  fr: "Français",
};

/**
 * Kept out of the component body on purpose: writing to `document.cookie` is a
 * mutation of module-external state, which the React Compiler's immutability
 * rule rejects inside a component.
 */
function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const activeLocale = useLocale();
  const router = useRouter();

  function selectLocale(locale: Locale) {
    if (locale === activeLocale) {
      return;
    }

    writeLocaleCookie(locale);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("flex items-center gap-0.5", className)}
    >
      {LOCALES.map((locale) => {
        const isActive = locale === activeLocale;

        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            title={LOCALE_ENDONYM[locale]}
            // aria-current, not aria-pressed: this is a set of alternatives of
            // which exactly one is in effect, like a nav item.
            aria-current={isActive ? "true" : undefined}
            onClick={() => selectLocale(locale)}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

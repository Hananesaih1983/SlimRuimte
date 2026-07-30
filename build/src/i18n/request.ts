import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * next-intl request configuration (i18n without routing).
 *
 * The locale is not part of the URL — it comes from the `NEXT_LOCALE` cookie
 * that the language switcher sets. This keeps the role route groups
 * (`/homeowner/...`, `/contractor/...`) free of a `[locale]` segment.
 *
 * The cookie is currently the only source: `public.users.language` is written at
 * signup by the `handle_new_user` trigger but nothing reads it back, so a user
 * who switches language on one device does not carry that choice to another.
 * Wiring the two together is a separate change — see F17.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Amsterdam",
  };
});

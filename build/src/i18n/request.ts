import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * next-intl request configuration (i18n without routing).
 *
 * The locale is not part of the URL — it comes from the `NEXT_LOCALE` cookie,
 * which the language switcher sets and which we keep in sync with
 * `public.users.language` on login. This keeps the role route groups
 * (`/homeowner/...`, `/contractor/...`) free of a `[locale]` segment.
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

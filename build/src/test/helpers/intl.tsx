import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/nl.json";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

/**
 * The real message files, by locale. `renderWithIntl(ui, "en")` used to hand the
 * provider a locale of "en" but the Dutch messages, so a component could only
 * ever be asserted in Dutch and a missing EN/FR key stayed invisible.
 */
const MESSAGES_BY_LOCALE: Record<string, typeof messages> = {
  nl: messages,
  en: en as typeof messages,
  fr: fr as typeof messages,
};

/**
 * Test-side i18n plumbing.
 *
 * Server Components resolve their copy through `next-intl/server`, which needs a
 * request context that does not exist under vitest. `serverIntlMock()` stands in
 * for it and resolves against the REAL `messages/nl.json`, so a renamed or
 * missing key fails the test instead of shipping a raw key like
 * "dashboard.no_projects" to the founder's screen.
 *
 * Sync Server Components (and every client component) use `useTranslations`,
 * which reads the client provider — `renderWithIntl` supplies it with the same
 * messages, so both halves of a page agree on the copy.
 */

export { messages as nlMessages };

/** Resolve "dashboard.no_projects" against the message tree, or throw. */
export function lookupMessage(path: string): string {
  let node: unknown = messages;
  for (const segment of path.split(".")) {
    node = (node as Record<string, unknown>)?.[segment];
  }
  if (typeof node !== "string") {
    throw new Error(`Missing message: ${path}`);
  }
  return node;
}

/**
 * Module shape to return from `vi.mock("next-intl/server", ...)`. The factory is
 * hoisted above imports, so pull this in from inside it:
 *
 *   vi.mock("next-intl/server", async () => {
 *     const { serverIntlMock } = await import("../helpers/intl");
 *     return serverIntlMock();
 *   });
 */
export function serverIntlMock(locale = "nl") {
  return {
    getLocale: async () => locale,
    getTranslations: async (namespace?: string) => {
      return (key: string) =>
        lookupMessage(namespace ? `${namespace}.${key}` : key);
    },
  };
}

/** Render inside the client-side message provider, as the root layout does. */
export function renderWithIntl(ui: React.ReactElement, locale = "nl") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES_BY_LOCALE[locale] ?? messages}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

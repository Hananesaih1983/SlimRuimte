import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

/**
 * Public landing page — the entry point for every role.
 *
 * The proxy does not gate `/`, so this is the one page that renders with no
 * session, which is also where logging out now lands. A signed-in visitor gets
 * a route back into the app instead of a second invitation to register:
 * /dashboard is the role dispatcher, so this page never needs to know the role.
 *
 * Copy comes from the `home` namespace in NL/EN/FR (F17). `Home` itself is async
 * (it awaits the session) so it could not call `useTranslations`; the sections
 * below are sync Server Components, which can — that keeps each section owning
 * its own copy instead of threading a translator through props.
 */
export default async function Home() {
  const signedIn = (await getSessionUser()) !== null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader signedIn={signedIn} />

      <main className="flex-1">
        <Hero signedIn={signedIn} />
        <ValueProps />
        <ClosingCta signedIn={signedIn} />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("home");

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          SlimRuimte
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              {t("cta_dashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                {t("cta_login")}
              </Link>
              <Link href="/auth/register" className={buttonVariants({ size: "lg" })}>
                {t("cta_register")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("home");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {t("hero_title")}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("hero_body")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={signedIn ? "/dashboard" : "/auth/register"}
          className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
        >
          {signedIn ? t("cta_dashboard") : t("cta_start")}
        </Link>
        {signedIn ? null : (
          <Link
            href="/auth/login"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            {t("cta_login")}
          </Link>
        )}
      </div>
      {signedIn ? null : (
        <p className="text-sm text-muted-foreground">{t("no_card")}</p>
      )}
    </section>
  );
}

/** Icon plus the message keys that carry its copy, in display order. */
const VALUE_PROPS = [
  { icon: "📐", titleKey: "value1_title", bodyKey: "value1_desc" },
  { icon: "🎨", titleKey: "value2_title", bodyKey: "value2_desc" },
  { icon: "🔨", titleKey: "value3_title", bodyKey: "value3_desc" },
] as const;

function ValueProps() {
  const t = useTranslations("home");

  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <article
            key={prop.titleKey}
            className="flex flex-col gap-2 rounded-xl border border-border bg-background px-5 py-6"
          >
            <span aria-hidden className="text-3xl">
              {prop.icon}
            </span>
            <h2 className="text-base font-semibold">{t(prop.titleKey)}</h2>
            <p className="text-sm text-muted-foreground">{t(prop.bodyKey)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClosingCta({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("home");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t("closing_title")}</h2>
      <p className="max-w-xl text-muted-foreground">
        {signedIn ? t("closing_signed_in") : t("closing_signed_out")}
      </p>
      <Link
        href={signedIn ? "/dashboard" : "/auth/register"}
        className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
      >
        {signedIn ? t("cta_dashboard") : t("cta_start")}
      </Link>
    </section>
  );
}

function SiteFooter() {
  const t = useTranslations("home");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
        SlimRuimte — {t("tagline")}
      </div>
    </footer>
  );
}

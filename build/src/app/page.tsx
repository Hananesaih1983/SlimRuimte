import Link from "next/link";
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
 * Copy is hardcoded Dutch rather than next-intl, matching the other
 * homeowner-facing pages. NL is the launch market (F17 adds EN/FR later).
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

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          SlimRuimte — verbouwen begint met weten hoe het wordt.
        </div>
      </footer>
    </div>
  );
}

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          SlimRuimte
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Naar mijn dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Inloggen
              </Link>
              <Link href="/auth/register" className={buttonVariants({ size: "lg" })}>
                Registreren
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Zie je verbouwing voordat je begint
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Scan je ruimte met je telefoon of meet handmatig op. SlimRuimte maakt een
        exacte plattegrond, laat je nieuwe keuken of badkamer in 3D zien, en
        brengt je in contact met geverifieerde aannemers in Nederland en België.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={signedIn ? "/dashboard" : "/auth/register"}
          className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
        >
          {signedIn ? "Naar mijn dashboard" : "Start gratis"}
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
            Inloggen
          </Link>
        )}
      </div>
      {signedIn ? null : (
        <p className="text-sm text-muted-foreground">
          Gratis te proberen · Geen creditcard nodig
        </p>
      )}
    </section>
  );
}

const VALUE_PROPS = [
  {
    icon: "📐",
    title: "Exacte plattegrond",
    body: "Scan je ruimte of meet handmatig. Nauwkeurig tot 2 cm.",
  },
  {
    icon: "🎨",
    title: "3D renders voor je verbouwing",
    body: "Zie je nieuwe keuken of badkamer voor je begint.",
  },
  {
    icon: "🔨",
    title: "Betrouwbare aannemers",
    body: "Drie geverifieerde aannemers ontvangen je visuele brief.",
  },
] as const;

function ValueProps() {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <article
            key={prop.title}
            className="flex flex-col gap-2 rounded-xl border border-border bg-background px-5 py-6"
          >
            <span aria-hidden className="text-3xl">
              {prop.icon}
            </span>
            <h2 className="text-base font-semibold">{prop.title}</h2>
            <p className="text-sm text-muted-foreground">{prop.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Klaar om je ruimte in te meten?
      </h2>
      <p className="max-w-xl text-muted-foreground">
        {signedIn
          ? "Ga verder waar je gebleven was en start je volgende project."
          : "Maak een account aan en start je eerste project. Je hebt alleen je telefoon en tien minuten nodig."}
      </p>
      <Link
        href={signedIn ? "/dashboard" : "/auth/register"}
        className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
      >
        {signedIn ? "Naar mijn dashboard" : "Start gratis"}
      </Link>
    </section>
  );
}

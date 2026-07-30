"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Without this, a throw in any Server Component (a dropped Supabase connection,
 * a malformed row) renders Next.js's bare "Application error" screen — no way
 * back and nothing the founder can act on during user testing.
 *
 * Copy is hardcoded Dutch: this renders when things are already broken, so it
 * must not depend on the i18n provider having loaded.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack in production.
    console.error("Onverwachte fout:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Er is iets misgegaan
      </h1>
      <p className="text-sm text-muted-foreground">
        We konden deze pagina niet laden. Je gegevens zijn niet verloren —
        probeer het opnieuw.
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="button" size="lg" onClick={reset}>
          Opnieuw proberen
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Naar de homepage
        </Link>
      </div>

      {error.digest ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Foutcode: {error.digest}
        </p>
      ) : null}
    </div>
  );
}

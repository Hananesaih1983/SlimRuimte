"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import type { RoomDimensions } from "@/lib/scan/types";

/**
 * Two-step LiDAR import: instructions, then the project code.
 *
 * Kept on one route rather than two so the user can flip back to the steps
 * while holding their phone, without losing the code they already typed.
 */

const SCAN_STEPS = [
  "Download de magicplan-app uit de App Store en maak een gratis account aan.",
  "Tik op ‘Nieuw project’ en kies ‘Ruimte scannen’ (LiDAR).",
  "Loop rustig langs alle muren tot de ruimte volledig gesloten is.",
  "Controleer deuren en ramen en rond de scan af.",
  "Open ‘Projectinfo’ en noteer de projectcode — die vul je hieronder in.",
];

export function LidarImport({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [projectCode, setProjectCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<RoomDimensions | null>(null);

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (projectCode.trim() === "") {
      setError("Vul je magicplan-projectcode in.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/scan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode: projectCode.trim(), projectId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "De import is mislukt. Probeer het opnieuw.");
        setPending(false);
        return;
      }

      setImported(payload as RoomDimensions);
      setPending(false);
    } catch {
      setError("Geen verbinding. Controleer je internet en probeer het opnieuw.");
      setPending(false);
    }
  }

  if (imported) {
    return (
      <ImportSuccess
        projectId={projectId}
        result={imported}
        onContinue={() => router.push(`/homeowner/project/${projectId}`)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Stap {step} van 2
        </p>
        <h1 className="text-2xl font-semibold">
          {step === 1 ? "Scan je ruimte in magicplan" : "Importeer je scan"}
        </h1>
      </header>

      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <MagicplanLogo />

          <ol className="flex flex-col gap-3">
            {SCAN_STEPS.map((text, index) => (
              <li key={text} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={() => setStep(2)}>
              Ik heb gescand →
            </Button>
            <Link
              href="/homeowner/project/new"
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              Andere methode kiezen
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleImport} className="flex max-w-md flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="projectCode" className="text-sm font-medium">
              magicplan-projectcode
            </label>
            <input
              id="projectCode"
              name="projectCode"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              placeholder="bijv. MP-4821-KTN"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              Te vinden onder ‘Projectinfo’ in de magicplan-app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Importeren…" : "Importeren →"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={pending}
              onClick={() => setStep(1)}
            >
              Terug naar instructies
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ImportSuccess({
  projectId,
  result,
  onContinue,
}: {
  projectId: string;
  result: RoomDimensions;
  onContinue: () => void;
}) {
  const { dimensions, walls, accuracy, source } = result;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Scan geïmporteerd ✅</h1>
        <p className="text-sm text-muted-foreground">
          We hebben de plattegrond opgehaald en aan je project gekoppeld.
        </p>
      </div>

      {source === "mock" ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Testdata — er is nog geen magicplan-API-sleutel ingesteld, dus dit is
          een voorbeeldscan.
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr]">
        <RoomDiagramSVG walls={walls} className="w-full rounded-xl border border-border" />

        <dl className="grid h-fit grid-cols-2 gap-3">
          <Fact label="Breedte" value={`${dimensions.width.toFixed(2)} m`} />
          <Fact label="Diepte" value={`${dimensions.depth.toFixed(2)} m`} />
          <Fact label="Hoogte" value={`${dimensions.height.toFixed(2)} m`} />
          <Fact label="Oppervlakte" value={`${dimensions.area.toFixed(2)} m²`} />
          <Fact label="Omtrek" value={`${dimensions.perimeter.toFixed(2)} m`} />
          <Fact label="Nauwkeurigheid" value={accuracy} />
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={onContinue}>
          Naar mijn project →
        </Button>
        <Link
          href={`/homeowner/project/${projectId}`}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Projectoverzicht
        </Link>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** Placeholder mark — magicplan has not given us brand assets to ship yet. */
function MagicplanLogo() {
  return (
    <div className="flex w-fit items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-xl"
      >
        📐
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">magicplan</span>
        <span className="text-xs text-muted-foreground">
          LiDAR-scan · gratis account
        </span>
      </div>
    </div>
  );
}

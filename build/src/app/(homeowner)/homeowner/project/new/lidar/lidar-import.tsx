"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { RoomDiagramSVG } from "@/components/scan/RoomDiagramSVG";
import type { RoomDimensions } from "@/lib/scan/types";

/**
 * Two-step RoomPlan import: instructions, then the Room.json upload.
 *
 * Kept on one route rather than two so the user can flip back to the steps
 * while holding their phone, without losing the file they already picked.
 */

const SCAN_STEPS = [
  null, // Step 1 is rendered separately with a download button
  "Open de app en tik op de + knop om een nieuwe scan te starten.",
  "Loop rustig langs alle muren tot de ruimte volledig gesloten is (±2 minuten).",
  "Tik op Gereed → Exporteer → Room.json en sla het bestand op.",
  "Upload het Room.json bestand hieronder — wij verwerken het automatisch.",
];

const WRONG_FILE_TYPE =
  "Selecteer een geldig Room.json bestand (geëxporteerd uit 3D Scanner App).";

export function LidarImport({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<RoomDimensions | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    // `accept` filters the picker, not a drag-and-drop or an "All files" pick,
    // so the extension is checked here too before we spend an upload on it.
    if (selected && !isJsonFile(selected)) {
      setFile(null);
      setError(WRONG_FILE_TYPE);
      return;
    }

    setFile(selected);
    setError(null);
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !isJsonFile(file)) {
      setError(WRONG_FILE_TYPE);
      return;
    }

    setError(null);
    setPending(true);

    const body = new FormData();
    body.append("file", file);
    body.append("projectId", projectId);

    try {
      const response = await fetch("/api/scan/roomplan-upload", {
        method: "POST",
        body,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "De import is mislukt. Probeer het opnieuw.");
        setPending(false);
        return;
      }

      setImported(payload.dimensions as RoomDimensions);
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
          {step === 1
            ? "Scan je ruimte met de 3D Scanner App"
            : "Upload je scan"}
        </h1>
      </header>

      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <AppStoreBadge />

          <ol className="flex flex-col gap-3">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <span className="text-sm">
                Download de gratis{" "}
                <a
                  href="https://apps.apple.com/app/3d-scanner-app/id1419913995"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  3D Scanner App
                </a>{" "}
                uit de App Store (door Laan Labs). Geen account nodig.
              </span>
            </li>
            {SCAN_STEPS.filter(Boolean).map((text, index) => (
              <li key={text} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 2}
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
            <label htmlFor="roomJson" className="text-sm font-medium">
              Selecteer Room.json
            </label>
            <input
              id="roomJson"
              name="file"
              type="file"
              accept=".json,application/json"
              required
              onChange={handleFileChange}
              className="rounded-lg border border-border bg-background text-sm outline-none file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:border-r file:border-border file:bg-muted file:px-3 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {file ? (
              <p className="text-xs font-medium">Gekozen bestand: {file.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Te vinden onder ‘Exporteer’ in de 3D Scanner App.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Importeren…" : "Ruimte importeren →"}
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

          <p className="text-xs text-muted-foreground">
            Nauwkeurigheid: ±1-2 cm (Apple RoomPlan LiDAR)
          </p>
        </form>
      )}
    </div>
  );
}

function isJsonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".json");
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
  const { dimensions, walls, accuracy } = result;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Scan geïmporteerd ✅</h1>
        <p className="text-sm text-muted-foreground">
          We hebben je RoomPlan-scan verwerkt en aan je project gekoppeld.
        </p>
      </div>

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

/** Placeholder badge — no App Store artwork is licensed into the repo yet. */
function AppStoreBadge() {
  return (
    <a
      href="https://apps.apple.com/app/3d-scanner-app/id1419913995"
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-fit items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-xl"
      >
        📱
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">3D Scanner App downloaden →</span>
        <span className="text-xs text-muted-foreground">
          Laan Labs · gratis · Apple App Store · iPhone 12 Pro+ / iPad Pro
        </span>
      </div>
    </a>
  );
}

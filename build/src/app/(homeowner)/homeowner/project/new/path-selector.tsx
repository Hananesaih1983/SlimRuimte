"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clearDraft, patchDraft } from "@/lib/scan/wizard-storage";

/**
 * The two scan paths.
 *
 * Both cards are always shown and both always work — `lidarLikely` only decides
 * which one gets the filled button and the "Aanbevolen" flag. A wrong guess
 * costs the user a glance, never a dead end.
 *
 * Choosing a path creates the project row first (`/api/projects/create`) and
 * then forwards its id, so every downstream step has somewhere to save and an
 * abandoned scan leaves a resumable draft on the dashboard.
 */

type Path = "lidar" | "manual";

export function PathSelector({ lidarLikely }: { lidarLikely: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Path | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(path: Path) {
    setError(null);
    setPending(path);

    try {
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: "NL" }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.projectId) {
        setError(payload?.error ?? "Project aanmaken mislukt. Probeer het opnieuw.");
        setPending(null);
        return;
      }

      // A fresh project means any half-finished wizard draft is stale.
      clearDraft();
      patchDraft({ projectId: payload.projectId });

      router.push(
        `/homeowner/project/new/${path}?projectId=${encodeURIComponent(payload.projectId)}`,
      );
    } catch {
      setError("Geen verbinding. Controleer je internet en probeer het opnieuw.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PathCard
          icon="📱"
          title="LiDAR scan"
          subtitle="iPhone 12 Pro+ of iPad Pro"
          badge="Nauwkeurigheid ±1-2 cm"
          cta="Scan met magicplan →"
          recommended={lidarLikely}
          primary={lidarLikely}
          pending={pending === "lidar"}
          disabled={pending !== null}
          onSelect={() => start("lidar")}
        />

        <PathCard
          icon="📐"
          title="Handmatig meten"
          subtitle="Alle apparaten"
          badge="Nauwkeurigheid ±0.5-2 cm"
          cta="Maten invoeren →"
          recommended={!lidarLikely}
          primary={!lidarLikely}
          pending={pending === "manual"}
          disabled={pending !== null}
          onSelect={() => start("manual")}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Geen iPhone Pro? Handmatig meten geeft dezelfde nauwkeurigheid met een
        laserafstandsmeter.
      </p>
    </div>
  );
}

function PathCard({
  icon,
  title,
  subtitle,
  badge,
  cta,
  recommended,
  primary,
  pending,
  disabled,
  onSelect,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  recommended: boolean;
  primary: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5 transition-colors",
        primary ? "border-primary/40 bg-primary/5" : "border-border bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-3xl">
          {icon}
        </span>
        {recommended ? (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Aanbevolen
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {badge}
      </span>

      <Button
        type="button"
        size="lg"
        variant={primary ? "default" : "outline"}
        className="mt-auto w-full"
        disabled={disabled}
        onClick={onSelect}
      >
        {pending ? "Bezig…" : cta}
      </Button>
    </div>
  );
}

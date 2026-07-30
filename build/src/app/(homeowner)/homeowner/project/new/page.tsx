import type { Metadata } from "next";
import { headers } from "next/headers";
import { detectDeviceCapability } from "@/lib/scan/device";
import { isUuid } from "@/lib/uuid";
import { PathSelector } from "./path-selector";

export const metadata: Metadata = {
  title: "Nieuwe ruimte scannen",
};

/**
 * Entry point of the scan flow: pick LiDAR or manual measurement.
 *
 * Device detection runs on the server from the User-Agent header so the right
 * card is primary in the first paint — no flash of the wrong layout. See
 * `src/lib/scan/device.ts` for why this is a hint and not a hard gate.
 *
 * `?projectId=` means "measure THIS project", which is how the project detail
 * page links here for a project that has no dimensions yet. Without it every
 * visit creates a new project row — see PathSelector.
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; from?: string }>;
}) {
  const [{ projectId, from }, requestHeaders] = await Promise.all([
    searchParams,
    headers(),
  ]);
  const capability = detectDeviceCapability(requestHeaders.get("user-agent"));
  const existingProjectId = isUuid(projectId) ? projectId : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {existingProjectId ? "Ruimte opmeten" : "Nieuwe ruimte scannen"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Kies hoe je de ruimte opmeet. Beide methodes leveren dezelfde
          plattegrond op.
        </p>
      </div>

      {/* Arrived from the OS share sheet (see /api/share-target). The shared
          file is not carried across yet, so say so instead of letting the user
          wonder where their scan went. */}
      {from === "share" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          💡 <strong>Je scan is gedeeld met SlimRuimte.</strong> Kies hieronder
          de LiDAR-methode en upload het bestand — dan koppelen we het aan een
          nieuw project.
        </div>
      ) : null}

      <PathSelector
        lidarLikely={capability.lidarLikely}
        existingProjectId={existingProjectId}
      />
    </div>
  );
}

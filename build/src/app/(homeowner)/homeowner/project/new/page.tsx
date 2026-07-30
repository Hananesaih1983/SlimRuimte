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
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [{ projectId }, requestHeaders] = await Promise.all([
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

      <PathSelector
        lidarLikely={capability.lidarLikely}
        existingProjectId={existingProjectId}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { detectDeviceCapability } from "@/lib/scan/device";
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
 */
export default async function NewProjectPage() {
  const userAgent = (await headers()).get("user-agent");
  const capability = detectDeviceCapability(userAgent);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Nieuwe ruimte scannen</h1>
        <p className="text-sm text-muted-foreground">
          Kies hoe je de ruimte opmeet. Beide methodes leveren dezelfde
          plattegrond op.
        </p>
      </div>

      <PathSelector lidarLikely={capability.lidarLikely} />
    </div>
  );
}

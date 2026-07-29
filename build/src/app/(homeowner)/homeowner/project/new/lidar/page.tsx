import type { Metadata } from "next";
import Link from "next/link";
import { isUuid } from "@/lib/api-auth";
import { LidarImport } from "./lidar-import";

export const metadata: Metadata = {
  title: "LiDAR scan importeren",
};

/**
 * LiDAR path: scan in the 3D Scanner App, then upload the exported Room.json.
 *
 * The capture itself happens outside our app — Apple's RoomPlan owns the ARKit
 * session — so all we do here is instruct, then parse the export through
 * /api/scan/roomplan-upload.
 */
export default async function LidarScanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await searchParams;

  if (!isUuid(projectId)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Project ontbreekt</h1>
        <p className="text-sm text-muted-foreground">
          We konden dit project niet vinden. Start de scan opnieuw.
        </p>
        <Link
          href="/homeowner/project/new"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Terug naar scan starten
        </Link>
      </div>
    );
  }

  return <LidarImport projectId={projectId} />;
}

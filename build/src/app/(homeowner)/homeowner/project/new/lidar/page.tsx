import type { Metadata } from "next";
import Link from "next/link";
import { isUuid } from "@/lib/api-auth";
import { LidarImport } from "./lidar-import";

export const metadata: Metadata = {
  title: "LiDAR scan importeren",
};

/**
 * LiDAR path: scan in the magicplan app, then import the result by project code.
 *
 * The scan itself happens outside our app — magicplan owns the ARKit capture —
 * so all we do here is instruct, then pull the finished plan in through
 * /api/scan/import.
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

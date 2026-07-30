import { NextResponse } from "next/server";

/**
 * Web Share Target — the manifest's `share_target.action`.
 *
 * When SlimRuimte is installed to the home screen it appears in the OS share
 * sheet, so a homeowner can finish a scan in the 3D Scanner App and hit Share →
 * SlimRuimte instead of saving a file and hunting for it again in our picker.
 *
 * Week 2 scope is the entry point only: land the user on the scan flow. The
 * shared file is intentionally NOT read here, because there is nowhere to put
 * it yet — /api/scan/roomplan-upload needs a projectId, and a share arrives
 * with no project context. Auto-attaching the payload (park it in storage,
 * claim it after the project exists) is the Week 3 follow-up; until then the
 * user re-picks the file on the LiDAR page, which they were doing anyway.
 *
 * Auth is not checked here on purpose. The redirect target lives under
 * /homeowner, and `src/proxy.ts` already bounces an anonymous or wrong-role
 * visitor from there — to /auth/login?redirect=… or to their own dashboard.
 * Repeating that logic in this route would be a second copy to keep in sync.
 */

/**
 * Where a share lands: the scan-method picker, not the LiDAR page.
 *
 * /homeowner/project/new/lidar renders "Project ontbreekt" without a
 * `?projectId=`, and a share never carries one. The picker creates the project
 * and then forwards to LiDAR with the id attached.
 */
const SHARE_LANDING = "/homeowner/project/new?from=share";

function redirectToScanFlow(request: Request): NextResponse {
  // 303 rather than 307: the share target is a POST, and the browser must
  // follow it with a GET. A 307 would replay the POST at a page route (405).
  return NextResponse.redirect(new URL(SHARE_LANDING, request.url), 303);
}

/** Text/URL-only shares, and any browser that sends the target as a GET. */
export async function GET(request: Request) {
  return redirectToScanFlow(request);
}

export async function POST(request: Request) {
  // The body is drained and dropped. Not reading it at all leaves the request
  // stream unconsumed, which some runtimes log as an aborted upload.
  await request.arrayBuffer().catch(() => undefined);

  return redirectToScanFlow(request);
}

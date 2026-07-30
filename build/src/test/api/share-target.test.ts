// @vitest-environment node

import { describe, expect, it } from "vitest";

const { GET, POST } = await import("@/app/api/share-target/route");

const LANDING = "http://localhost/homeowner/project/new?from=share";

/**
 * The share target has no auth of its own — `src/proxy.ts` guards the
 * /homeowner destination it points at. What matters here is that both verbs
 * land on a page that actually renders, with a status the browser will follow
 * as a GET.
 */
describe("GET /api/share-target", () => {
  it("redirects a text-only share to the scan flow", async () => {
    const response = await GET(
      new Request("http://localhost/api/share-target?title=Woonkamer"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(LANDING);
  });
});

describe("POST /api/share-target", () => {
  async function postShare(): Promise<Response> {
    const body = new FormData();
    body.append("title", "Woonkamer");
    body.append(
      "file",
      new File([JSON.stringify({ version: 1 })], "Room.json", {
        type: "application/json",
      }),
    );

    return POST(
      new Request("http://localhost/api/share-target", { method: "POST", body }),
    );
  }

  it("redirects a shared file to the scan flow", async () => {
    const response = await postShare();

    expect(response.headers.get("location")).toBe(LANDING);
  });

  it("uses 303 so the browser follows with a GET, not a replayed POST", async () => {
    // A 307 here would re-POST to a page route and 405. This is the whole
    // reason the status is pinned in a test.
    const response = await postShare();

    expect(response.status).toBe(303);
  });

  it("does not send the user to a page that needs a projectId", async () => {
    // /homeowner/project/new/lidar renders "Project ontbreekt" without one,
    // and a share never carries a project id.
    const response = await postShare();

    expect(response.headers.get("location")).not.toContain("/lidar");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * THE DUPLICATE PROJECT BUG
 *
 * `PathSelector` creates the project row before entering the wizard, which is
 * right for "Nieuw project starten" and wrong for every other way in. The
 * project detail page links here as `?projectId=<id>` for a project that has no
 * dimensions yet ("Ruimte scannen →"), and the selector used to ignore the
 * parameter and POST /api/projects/create anyway. Each attempt:
 *
 *   - created a second, empty project on the homeowner's dashboard,
 *   - attached the scan to that new project instead of the one they opened,
 *   - and burned one of their five MVP project slots (F18).
 *
 * The tests below pin both directions: create when there is nothing to measure,
 * reuse when there is.
 */

const push = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const clearDraft = vi.fn();
const patchDraft = vi.fn();

vi.mock("@/lib/scan/wizard-storage", () => ({
  clearDraft: () => clearDraft(),
  patchDraft: (patch: unknown) => patchDraft(patch),
}));

const { PathSelector } = await import(
  "@/app/(homeowner)/homeowner/project/new/path-selector"
);

const NEW_PROJECT = "00000000-0000-4000-8000-000000000099";
const EXISTING_PROJECT = "00000000-0000-4000-8000-000000000050";

function created(projectId: string) {
  return {
    ok: true,
    json: async () => ({ projectId }),
  } as Response;
}

beforeEach(() => {
  push.mockReset();
  clearDraft.mockReset();
  patchDraft.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(created(NEW_PROJECT));
  vi.stubGlobal("fetch", fetchMock);
});

describe("PathSelector without an existing project", () => {
  it("creates a project, then enters the chosen wizard with its id", async () => {
    render(<PathSelector lidarLikely={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/create");
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/homeowner/project/new/manual?projectId=${NEW_PROJECT}`,
      ),
    );
  });

  it("routes the LiDAR card to the LiDAR wizard", async () => {
    render(<PathSelector lidarLikely />);

    fireEvent.click(screen.getByRole("button", { name: /Scan met 3D Scanner App/ }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/homeowner/project/new/lidar?projectId=${NEW_PROJECT}`,
      ),
    );
  });

  it("clears a stale draft and records the new project id", async () => {
    render(<PathSelector lidarLikely={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    await waitFor(() => expect(clearDraft).toHaveBeenCalled());
    expect(patchDraft).toHaveBeenCalledWith({ projectId: NEW_PROJECT });
    expect(clearDraft.mock.invocationCallOrder[0]).toBeLessThan(
      patchDraft.mock.invocationCallOrder[0],
    );
  });

  it("surfaces the API error instead of entering a wizard with nowhere to save", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Je hebt het maximum van 5 projecten bereikt." }),
    } as Response);

    render(<PathSelector lidarLikely={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/maximum van 5 projecten/);
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a dropped connection in Dutch", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(<PathSelector lidarLikely={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Geen verbinding/);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("PathSelector with an existing project to measure", () => {
  it("reuses the project instead of creating a second one", async () => {
    render(<PathSelector lidarLikely={false} existingProjectId={EXISTING_PROJECT} />);

    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/homeowner/project/new/manual?projectId=${EXISTING_PROJECT}`,
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses it on the LiDAR path too", async () => {
    render(<PathSelector lidarLikely existingProjectId={EXISTING_PROJECT} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan met 3D Scanner App/ }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/homeowner/project/new/lidar?projectId=${EXISTING_PROJECT}`,
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still points the wizard draft at the project being measured", async () => {
    render(<PathSelector lidarLikely={false} existingProjectId={EXISTING_PROJECT} />);

    fireEvent.click(screen.getByRole("button", { name: /Maten invoeren/ }));

    await waitFor(() =>
      expect(patchDraft).toHaveBeenCalledWith({ projectId: EXISTING_PROJECT }),
    );
  });

  it("offers both scan methods either way", async () => {
    render(<PathSelector lidarLikely={false} existingProjectId={EXISTING_PROJECT} />);

    expect(screen.getByRole("button", { name: /Maten invoeren/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Scan met 3D Scanner App/ })).toBeEnabled();
  });
});

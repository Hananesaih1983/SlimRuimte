"use client";

import { useSyncExternalStore } from "react";

/**
 * Home-screen install nudge shown above the LiDAR scan instructions.
 *
 * Why it sits on this page: installing is the only way SlimRuimte can appear
 * in the OS share sheet, and the share sheet is what removes the worst step of
 * the LiDAR flow (export → Save to Files → find the file again in our picker).
 *
 * The copy differs per platform because the capability does:
 *  - Android/Chrome honours the manifest's `share_target`, so an installed app
 *    really does show up in the 3D Scanner App's share sheet.
 *  - iOS Safari supports Add to Home Screen but NOT Web Share Target, so an
 *    installed app there is a launcher shortcut, nothing more. Promising
 *    "share straight to SlimRuimte" on iOS would be a promise iOS breaks.
 */

type Platform = "ios" | "android" | "other";

const STANDALONE_QUERY = "(display-mode: standalone)";

/** Re-render if the app is launched into, or dropped out of, standalone mode. */
function subscribeToDisplayMode(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ reports itself as a Mac; the touch-point count gives it away.
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return "other";
}

function detectInstalled(): boolean {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    // iOS Safari's own flag; it never sets the display-mode media query.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  // `null` on the server and during hydration — both checks need `window`, and
  // rendering nothing until the client snapshot arrives keeps the server and
  // client markup identical instead of trading a hydration mismatch for it.
  const installed = useSyncExternalStore<boolean | null>(
    subscribeToDisplayMode,
    detectInstalled,
    () => null,
  );

  if (installed === null) return null;

  const platform = detectPlatform();

  if (installed) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {platform === "ios" ? (
          <>
            ✅ <strong>SlimRuimte is on your home screen.</strong> Scan your
            room, export it, and come back here to upload — the app stays open
            in the background.
          </>
        ) : (
          <>
            ✅ <strong>SlimRuimte is installed.</strong> After scanning, tap{" "}
            <strong>Share</strong> in the 3D Scanner App and pick{" "}
            <strong>SlimRuimte</strong> — no need to save the file first.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      <p>
        📲 <strong>Add SlimRuimte to your home screen.</strong>{" "}
        {platform === "android"
          ? "Then you can share a scan straight from the 3D Scanner App — no file saving needed."
          : "It opens like an app, so you can switch between scanning and uploading without losing your place."}
      </p>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-medium underline-offset-2 hover:underline">
          How to install
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">iPhone or iPad (Safari):</strong>{" "}
            tap the Share icon → scroll down → tap{" "}
            <strong>Add to Home Screen</strong> → tap <strong>Add</strong>.
          </p>
          <p>
            <strong className="text-foreground">Android (Chrome):</strong> tap
            the menu (3 dots) → tap <strong>Add to Home screen</strong> → tap{" "}
            <strong>Add</strong>.
          </p>
        </div>
      </details>
    </div>
  );
}

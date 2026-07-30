"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js` once per page load.
 *
 * The worker itself does nothing useful (see the file) — installability is the
 * point, because an installed PWA is what registers SlimRuimte as a share
 * target for the 3D Scanner App's export sheet.
 *
 * Rendered from the root layout, after the app, so registration never competes
 * with first paint.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // A failed registration (private mode, unsupported browser, http on a
    // non-localhost host) must stay silent — nothing the user can act on.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}

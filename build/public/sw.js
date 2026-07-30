/**
 * Minimal service worker.
 *
 * It exists because a browser will not offer "install" without one, and the
 * install is what puts SlimRuimte in the share sheet. It deliberately caches
 * nothing: a stale-asset bug in week 2 of a 12-week build costs more than
 * offline support is worth, and Next.js already handles its own asset
 * versioning. Add caching here only once there is something worth caching.
 */

self.addEventListener("install", () => {
  // Don't sit in "waiting" behind an older worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through. Present only so the worker counts as controlling the page.
  event.respondWith(fetch(event.request));
});

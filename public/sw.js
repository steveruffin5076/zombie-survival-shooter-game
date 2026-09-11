/*
 * Minimal service worker. Two reasons it exists:
 *
 * 1. Chrome only treats a site as installable — "Install app", which launches
 *    in the manifest's fullscreen display mode with no browser UI — when a
 *    service worker with a fetch handler is registered. Without one, "Add to
 *    Home screen" makes a plain shortcut that reopens in a normal tab.
 * 2. The whole game is one inlined HTML file, so caching it means it also
 *    plays offline.
 *
 * Bump CACHE when the caching strategy itself changes; ordinary deploys are
 * picked up by the network-first navigation handler below.
 */
const CACHE = "graveyard-shift-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["./", "./icon-192.png", "./icon-512.png"]))
      .catch(() => {/* a cold cache isn't worth failing the install over */})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Navigations go network-first so a fresh deploy always wins when online,
  // falling back to the cached shell when there's no connection.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./").then((hit) => hit || Response.error()))
    );
    return;
  }

  // Same-origin assets (icons): cache-first, they're immutable in practice.
  if (new URL(req.url).origin === self.location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

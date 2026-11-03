/*
  Rentora service worker.
  Safety rules: never cache signed-in pages, RSC payloads, API/auth routes, Supabase or any cross-origin
  request. Only hashed build assets and app icons are cached; navigations fall back to /offline when offline.
*/
const VERSION = "rentora-v2-brand";
const PRECACHE = ["/offline", "/icons/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and everything else: straight to the network.

  if (request.mode === "navigate") {
    // Network only. The cached offline page contains no user data.
    event.respondWith(fetch(request).catch(() => caches.match("/offline", { cacheName: VERSION })));
    return;
  }

  if (isCacheableAsset(url) && !request.headers.has("rsc") && !url.searchParams.has("_rsc")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      }),
    );
  }
  // Anything else (pages' data, server actions, auth routes, receipts): default network behaviour, no caching.
});

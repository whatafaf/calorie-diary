// Offline support. Bump VERSION whenever app files change so phones pick up the update.
const VERSION = "cd-2026-11-12d";
// No "./" here: Chrome treats it and index.html as the same entry and the whole install fails.
// Navigations are answered from "index.html" below anyway.
const SHELL = [
  "index.html",
  "manifest.webmanifest",
  "vendor/claude.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: serve from cache, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const key = req.mode === "navigate" ? "index.html" : req;
        const hit = await cache.match(key, { ignoreSearch: true });
        const net = fetch(req).then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Fonts and the barcode fallback library: cache after first use.
  if (/fonts\.(googleapis|gstatic)\.com$|cdn\.jsdelivr\.net$/.test(url.hostname)) {
    e.respondWith(
      caches.open(VERSION + "-ext").then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      })
    );
  }
  // Everything else (Anthropic API, Open Food Facts) goes straight to the network.
});

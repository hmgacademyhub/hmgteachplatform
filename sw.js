/* ============================================================
   HMG ClassDeck — Service Worker
   Cache-first for the app shell so the studio opens instantly
   and works offline (live class still needs internet, but the
   whiteboard/PDF/notes work fully offline).
   Bump CACHE_VERSION whenever you deploy changes.
   ============================================================ */
const CACHE_VERSION = "hmg-classdeck-v6.2.0";

const SHELL = [
  "./",
  "./index.html",
  "./teach.html",
  "./admin.html",
  "./join.html",
  "./css/style.css",
  "./js/common.js",
  "./js/whiteboard.js",
  "./js/webcast.js",
  "./js/rtc.js",
  "./js/teach.js",
  "./js/toolkit.js",
  "./js/toolkit-data.js",
  "./js/toolkit-data2.js",
  "./js/toolkit-ext.js",
  "./js/auth.js",
  "./js/join.js",
  "./vendor/peerjs.min.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/qrcode.min.js",
  "./assets/icon-96.png",
  "./assets/hmg-academy-logo.png",
  "./assets/founder-photo.jpg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept WebRTC signalling or cross-origin calls.
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        // refresh in background (stale-while-revalidate)
        fetch(e.request).then((res) => {
          if (res && res.ok) caches.open(CACHE_VERSION).then((c) => c.put(e.request, res));
        }).catch(() => {});
        return hit;
      }
      return fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

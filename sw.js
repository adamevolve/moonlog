const CACHE = "moonlog-phone-v3";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./ui_edit.js", "./auto_update.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Network first, so new code arrives; the stored copy is for when offline
  event.respondWith(fetch(event.request).then((res) => {
    if (res.ok && new URL(event.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return res;
  }).catch(() => caches.match(event.request)));
});

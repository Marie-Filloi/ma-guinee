const CACHE_NAME = "maguinee-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./style.css",
  "./app.js",
  "./questions.js",
  "./manifest.json",
  "./icons/icon.png",
  "./icons/nimba.jpg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Réseau en priorité (pour toujours voir les mises à jour), cache en secours hors-ligne.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

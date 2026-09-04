/* ============================================================
   Study Live — Service Worker (offline + installability)
   Network-first for everything, cache as offline fallback.
   (cache-first kept serving stale assets after code changes —
   the bug that made updates invisible in the browser)
   Bump CACHE version when shipping changed assets.
   ============================================================ */
var CACHE = 'study-live-v30';

self.addEventListener('install', function (event) {
  // no precache list: assets are cached at runtime, so a deploy
  // is visible on the very next reload
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // network-first: try the live response, fall back to cache offline
  event.respondWith(
    fetch(event.request)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          // SPA fallback: navigations offline get the cached shell
          if (event.request.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
      })
  );
});

const CACHE_NAME = 'geocyclone-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.url.includes('/api/')) {
          return new Response(
            JSON.stringify({ error: "Offline Mode active. Cloud datasets require connectivity." }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      });
    })
  );
});

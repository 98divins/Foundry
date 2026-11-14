// Offline support: network first for navigations, cache first for assets.
const CACHE = 'foundry-v5';

// Only the app itself (fonts included) and exercise photos are cached. Live data (cloud sync,
// Open Food Facts) always goes to the network so it is never stale.
const CACHEABLE = (url) =>
  url.origin === self.location.origin ||
  (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('free-exercise-db')) ||
  (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('free-exercise-db'));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!CACHEABLE(new URL(req.url))) return;
  // Never cache the build marker: the app reads it to notice updates.
  if (new URL(req.url).pathname.endsWith('/version.json')) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      // Revalidate with the server every time, so a new deploy shows on the next open.
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

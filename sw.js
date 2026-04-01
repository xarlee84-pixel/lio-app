/**
 * LIO APP — Service Worker
 * Estrategia: Cache-first para assets estáticos y CDN.
 *             Network-only SIEMPRE para la API de Google Apps Script.
 */

const CACHE_NAME   = 'lio-app-v3';
const NEVER_CACHE  = ['script.google.com', 'googleusercontent.com'];

const PRECACHE = [
  './index.html',
  './icon.svg',
  './manifest.json',
];

// ── INSTALL: pre-cachea el shell de la app ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina caches viejos ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // NUNCA cachear llamadas a la API de GAS
  if (NEVER_CACHE.some(origin => url.includes(origin))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Si está en caché, devuélvelo y refresca en background (stale-while-revalidate)
      if (cached) {
        const revalidate = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached);
        return cached; // respuesta inmediata desde caché
      }

      // No está en caché: buscar en red y guardar
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin red y sin caché: devuelve el index para navegación
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

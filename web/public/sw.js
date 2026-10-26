// Huehuetéotl · service worker: guarda la app para abrirla sin señal.
// Las capas (.pmtiles) no pasan por aquí: la app las descarga completas a su almacén (ver src/capas.ts).
const VERSION = 'huehue-v3';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'favicon.png', 'geoug-clara.png', 'geoug.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('huehue-v') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/capas/')) return;
  // Datos que cambian (puntos de calor): primero la red, si no hay señal lo último guardado.
  if (url.pathname.includes('/datos/')) {
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  // App: primero lo guardado (rápido y sin señal) y se actualiza en segundo plano.
  e.respondWith(caches.match(e.request).then((guardado) => {
    const red = fetch(e.request).then((r) => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); } return r; }).catch(() => guardado);
    return guardado || red;
  }));
});

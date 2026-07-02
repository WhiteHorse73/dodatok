/* ВЕРСІЯ КЕШУ. Збільшуй число (v4, v5...) щоразу, коли треба гарантовано скинути кеш. */
const VERSION = 'pc-v20';
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();                                   // новий SW активується одразу
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))); // чистимо старі кеші
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  let url;
  try{ url = new URL(req.url); }catch(_){ return; }

  // ВАЖЛИВО: не втручаємось у сторонні запити (сервер 1С тощо) — хай ідуть напряму,
  // інакше service worker маскує реальні помилки мережі/CORS.
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';

  // HTML / навігація → СПОЧАТКУ мережа (свіжий index.html), кеш лише якщо немає інтернету
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // решта наших ресурсів (іконки, бібліотека сканера) → кеш, потім мережа
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});

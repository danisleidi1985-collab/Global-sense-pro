// ═══════════════════════════════════════════════════════════════
// 🔥 FF SENSEPRO 2026 — Service Worker v2.1
// Auto-update con version.json + Cache offline completo
// ═══════════════════════════════════════════════════════════════

const STATIC_CACHE = 'sensepro-static-v2.1';
const API_CACHE = 'sensepro-api-v1';

const STATIC_ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap',
];

// Nunca cachear — siempre frescos
const NEVER_CACHE = ['version.json', 'api.anthropic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS.map(u => new Request(u, {mode:'no-cors'}))))
      .then(() => self.skipWaiting())
      .catch(e => console.log('SW install error:', e))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const noCache = NEVER_CACHE.some(n => url.pathname.includes(n) || url.hostname.includes(n));

  if (noCache) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'}).catch(() =>
        new Response(JSON.stringify({version:'offline'}), {headers:{'Content-Type':'application/json'}})
      )
    );
    return;
  }

  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(event.request).then(c => c || fetch(event.request).then(r => {
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, r.clone()));
        return r;
      })).catch(() => new Response('',{status:408}))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        if (!r || r.status !== 200 || r.type === 'opaque') return r;
        caches.open(STATIC_CACHE).then(c => c.put(event.request, r.clone()));
        return r;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('./index.html');
        return new Response('Offline', {status:503});
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') caches.delete(STATIC_CACHE);
});

self.addEventListener('push', event => {
  if (!event.data) return;
  const d = event.data.json();
  self.registration.showNotification(d.title || '🔥 FF SensePro', {
    body: d.body || '¡Nuevo parche disponible!',
    icon: './icon-192.png', badge: './icon-192.png',
    tag: 'sensepro-update', vibrate: [100,50,100],
    data: {url: d.url || '/'}
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

console.log('🔥 SensePro SW v2.1 — Auto-update activo');

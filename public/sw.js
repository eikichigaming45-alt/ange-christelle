const CACHE_NAME = 'myvibe-v2.35';
const ASSETS = [
  '/', '/index.html', '/css/style.css',
  '/js/app.js', '/js/auth.js', '/js/widgets.js', '/js/modal.js',
  '/js/meteo.js', '/js/priere.js', '/js/taches.js',
  '/js/anniversaires.js', '/js/profil.js', '/js/admin.js',
  '/js/cycle.js', '/js/rendezvous.js', '/js/push.js',
  '/js/planning.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.titre || 'MyVibe', {
      body: data.corps || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'myvibe',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url || '/'));
});

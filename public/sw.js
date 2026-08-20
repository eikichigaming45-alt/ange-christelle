// ============================================================
// public/sw.js
// Service Worker — cache des assets statiques + push notifications.
// Version incrémentée à chaque push significatif.
// ============================================================

const CACHE_NAME = 'mydaily-cache-v3.58';

// Assets mis en cache à l'installation
const ASSETS_TO_CACHE = [
    '/css/style.css',
    '/js/app.js',
    '/js/widgets.js',
    '/js/modal.js',
    '/js/profil.js',
    '/js/planning.js',
    '/js/meteo.js',
    '/js/rendezvous.js',
    '/js/cycle.js',
    '/js/taches.js',
    '/js/anniversaires.js',
    '/js/priere.js',
    '/js/islam.js',
    '/js/push.js',
    '/js/admin.js',
    '/js/astrologie.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// ── Installation : mise en cache des assets ───────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

// ── Activation : suppression des anciens caches ───────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Messages depuis la page ───────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Fetch : stratégie par type de ressource ───────────────────
self.addEventListener('fetch', event => {
    if (event.request.url.startsWith('chrome-extension')) return;
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // API : toujours réseau — jamais de cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Fichiers critiques : network-first
    const networkFirst = ['/', '/index.html', '/css/style.css'];
    if (networkFirst.includes(url.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Autres assets : cache-first avec mise à jour en arrière-plan
    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetchPromise = fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
            return cached || fetchPromise;
        })
    );
});

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', event => {
    let data = {};
    try { data = event.data.json(); } catch {}
    event.waitUntil(
        self.registration.showNotification(data.titre || 'MyDaily', {
            body  : data.corps || '',
            icon  : '/icon-192.png',
            badge : '/icon-192.png',
            data  : { url: data.url || '/' },
            tag   : data.tag || 'mydaily'
        })
    );
});

// ── Clic sur notification ─────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data.url);
        })
    );
});

self.addEventListener('push', e => {
    const data = e.data?.json() || {};
    e.waitUntil(
        self.registration.showNotification(data.titre || 'MyVibe', {
            body: data.corps || '',
            icon: '/icon.png',
            badge: '/icon.png',
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

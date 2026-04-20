// Cache reset worker: remove old caches and unregister itself.
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(clients.map((client) => client.navigate(client.url)));

        await self.registration.unregister();
    })());
});

// Always pass requests through; no offline cache behavior.
self.addEventListener('fetch', () => {});

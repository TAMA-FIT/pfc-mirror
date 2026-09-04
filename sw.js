// PFC Mirror service-worker retirement shim.
// V41 intentionally has no offline HTML/runtime cache and no fetch interception.
const BUILD='20260904-v41-retire-sw';
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try {
      const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      clients.forEach(client => client.postMessage({type:'PFC_SW_RETIRED', build:BUILD}));
    } catch (_) {}
  })());
});
// Deliberately no fetch handler. Network is canonical.

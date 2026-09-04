// PFC Mirror service worker retirement shim.
// The mirror is under active development; stale service workers caused the app to roll back to V35.
// Keep this file so installed/old workers can update to it, then immediately unregister.
const PFC_CACHE_RE = /(pfc-mirror|tamafit-pfc-mirror)/i;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => PFC_CACHE_RE.test(k)).map(k => caches.delete(k)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});

// Intentionally no fetch handler: every request goes directly to the network/browser cache.

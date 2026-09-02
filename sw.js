const CACHE_NAME = 'tamafit-pfc-mirror-20260902-v7';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './database.js',
  './tamachan-data.js',
  './app.js',
  './ai.js',
  './main-inline.js',
  './manifest.json',
  './manifest-ios.json',
  './icon.png',
  './pfc-v6-chunk-01.js',
  './pfc-v6-chunk-02.js',
  './pfc-v6-chunk-03.js',
  './pfc-v6-chunk-04.js',
  './pfc-v6-chunk-05.js',
  './pfc-v6-chunk-06.js',
  './pfc-v6-chunk-07.js',
  './pfc-v6-chunk-08.js',
  './pfc-v6-chunk-09.js',
  './pfc-v6-chunk-10.js',
  './pfc-v6-chunk-11.js',
  './pfc-v6-loader.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

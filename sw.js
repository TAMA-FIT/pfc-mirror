const CACHE_NAME = 'tamafit-pfc-mirror-20260904-ai-v2-editfix1';
const AI_V2_SRC = './ai-v2.js?v=20260904-ai2';
const EDIT_FIX_SRC = './edit-fix.js?v=20260904-editfix1';
const AI_V2_TAG = `<script src="${AI_V2_SRC}"></script>`;
const EDIT_FIX_TAG = `<script src="${EDIT_FIX_SRC}"></script>`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './database.js',
  './tamachan-data.js',
  './app.js',
  './ai.js',
  './ai-v2.js',
  './edit-fix.js',
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

async function injectRuntime(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  const tags = [];
  if (!html.includes('ai-v2.js')) tags.push(AI_V2_TAG);
  if (!html.includes('edit-fix.js')) tags.push(EDIT_FIX_TAG);
  if (tags.length) {
    const block = `${tags.join('\n')}\n`;
    html = html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : `${html}\n${block}`;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function cacheInjectedIndex(cache) {
  const original = await cache.match('./index.html');
  if (!original) return;
  const injected = await injectRuntime(original);
  await cache.put('./index.html', injected.clone());
  await cache.put('./', injected.clone());
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(APP_SHELL);
        await cacheInjectedIndex(cache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => client.navigate(client.url).catch(() => null))))
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
        .then(injectRuntime)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put('./index.html', copy.clone());
            cache.put('./', copy);
          });
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

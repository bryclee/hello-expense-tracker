const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'expense-tracker-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/app.js',
  '/js/auth.js',
  '/js/gapi.js',
  '/js/config.js'
];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

sw.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

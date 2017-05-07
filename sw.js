importScripts('cache-manager.js');

const VERSION = '1';
const staticCache = `caches-v${VERSION}`;
const staticAssets = ['index.html', 'index.css', 'index.js'];
const dynamicCache = `dynamicCache`;
let cachedAssets;

const imageTest = /^.*\.(jpg|jpeg|png|gif)$/;
const imageDb = 'image';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(staticCache)
      .then((cache) => cache.addAll(staticAssets))
      .then(() => self.skipWaiting())
      .catch(console.error)
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [staticCache, dynamicCache];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.filter((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              return true;
            }
            return false;
          }).map((cacheName) => {
            return caches.delete(cacheName);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') goToNetworkNoCache(event);
  else {
    const url = new URL(event.request.url);
    if (staticAssets.includes(url.pathname) || staticAssets.includes(url.href)) {
      event.respondWith(caches.open(staticCache).then((cache) => {
          return cache.match(event.request);
      }));
    } else if (imageTest.test(url.pathname)) { // test for images
      handleImage(event);
    } else { // ¯\_(ツ)_/¯
      goToNetworkNoCache(event);
    }
  }
});

function goToNetworkNoCache(event) {
  event.respondWith(fetch(event.request));
}

function handleImage(event) {
  event.respondWith(
    fetch(event.request)
    .then((networkResponse) => {
      const url = new URL(event.request.url);
      return caches.open(dynamicCache).then((cache) => {
        cache.put(event.request, networkResponse.clone());
        return getDb(imageDb).then((db) => {
            setTimestampsForUrl(db, url.href, Date.now());
            expireEntries(db, 10, 300, Date.now())
                .then((extraUrls) => {
                if (extraUrls.length == 0) return;
                extraUrls.map((url) => cache.delete(url));
                })
                .catch(console.error);
            return networkResponse;
        });
      });
    })
    .catch(function() {
      return caches.match(event.request).then((response) => {
        return getDb(imageDb).then((db) => {
            updateUsedTimestampForUrl(db, url.href, Date.now());
            expireEntries(db, 20, 24*60*60*60, Date.now())
                .then((extraUrls) => {
                if (extraUrls.length == 0) return;
                extraUrls.map((url) => cache.delete(url));
                })
                .catch(console.error);
            return response;
        });
      });
    })
  );
}
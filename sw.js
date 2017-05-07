importScripts('cache-manager.js');

const VERSION = '1';
const staticCache = `caches-v${VERSION}`;
const staticAssets = ['/index.html', '/index.css', '/index.js'];
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
  const url = new URL(event.request.url);
  if (url.pathname === '/') {
    caches.open(staticCache).then((cache) => {
        return cache.match('/index.html');
    })
  } else if (staticAssets.includes(url.pathname) || staticAssets.includes(url.href)) {
    event.respondWith(caches.match(event.request));
  } else if (imageTest.test(url.pathname)) { // test for images
    handleImage(event);
  } else { // ¯\_(ツ)_/¯
    goToNetworkNoCache(event);
  }
});

function goToNetworkNoCache(event) {
  event.respondWith(fetch(event.request));
}

function handleImage(event) {
  const url = new URL(event.request.url);
  event.respondWith((async function() {
    try {
      const cacheResponse = await caches.match(event.request);
      let networkResponse;
      const db = await getDb(imageDb);

      if (cacheResponse) {
        updateUsedTimestampForUrl(db, url.href, Date.now());
      } else {
        networkResponse = await fetch(event.request);
        const cache = await caches.open(dynamicCache);
        await cache.put(event.request, networkResponse.clone());
        setTimestampsForUrl(db, url.href, Date.now());
      }
      return cacheResponse || networkResponse;
    }
    catch (err) {
      console.error(err);
      return new Response(null, {status: 404});
    }
  })());

  event.waitUntil((async function() {
    const db = await getDb(imageDb);
    const cache = await caches.open(dynamicCache);
    const extraUrls = await expireEntries(db, 10, 300, Date.now());
    if (extraUrls.length == 0) return;
    return Promise.all(extraUrls.map((url) => cache.delete(url)));
  })());
}
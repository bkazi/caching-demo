/*
Credit to:
https://github.com/GoogleChrome/sw-toolbox/blob/master/lib/idb-cache-expiration.js
for ideas and code
*/
'use strict';

const DB_PREFIX = 'demo-cache-';
const DB_VERSION = 1;
const STORE_NAME = 'store';
const URL_PROPERTY = 'url';
const ENTER_TIMESTAMP_PROP = 'enterTimestamp';
const USED_TIMESTAMP_PROP = 'usedTimestamp';
const cacheNameToDbPromise = {};

function openDb(cacheName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_PREFIX + cacheName, DB_VERSION);

    request.onupgradeneeded = () => {
      const objectStore = request.result.createObjectStore(STORE_NAME,
          {keyPath: URL_PROPERTY});
      objectStore.createIndex(ENTER_TIMESTAMP_PROP, ENTER_TIMESTAMP_PROP, {unique: false});
      objectStore.createIndex(USED_TIMESTAMP_PROP, USED_TIMESTAMP_PROP, {unique: false});
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function getDb(cacheName) {
  if (!(cacheName in cacheNameToDbPromise)) {
    cacheNameToDbPromise[cacheName] = openDb(cacheName);
  }

  return cacheNameToDbPromise[cacheName];
}

function setTimestampsForUrl(db, url, now) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    objectStore.put({url: url, enterTimestamp: now, usedTimestamp: now});

    transaction.oncomplete = () => {
      resolve(db);
    };

    transaction.onabort = () => {
      reject(transaction.error);
    };
  });
}

function updateUsedTimestampForUrl(db, url, now) {
  return new Promise((resolve, result) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(url);

    request.onerror = (event) => {
      reject(request.error);
    };
    request.onsuccess = (event) => {
      const data = event.target.result;
      data.usedTimestamp = now;

      const requestUpdate = objectStore.put(data);
      requestUpdate.onerror = (event) => {
        reject(requestUpdate.error);
      };
      requestUpdate.onsuccess = (event) => {
        resolve(db);
      };
    };
  });
}

function expireOldEntries(db, maxAgeSeconds, now) {
  // Bail out early by resolving with an empty array if we're not using
  // maxAgeSeconds.
  if (!maxAgeSeconds) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    const maxAgeMillis = maxAgeSeconds * 1000;
    let urls = [];

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index(ENTER_TIMESTAMP_PROP);

    index.openCursor().onsuccess = (cursorEvent) => {
      const cursor = cursorEvent.target.result;
      if (cursor) {
        if (now - maxAgeMillis > cursor.value[ENTER_TIMESTAMP_PROP]) {
          const url = cursor.value[URL_PROPERTY];
          urls.push(url);
          objectStore.delete(url);
          cursor.continue();
        }
      }
    };

    transaction.oncomplete = () => {
      resolve(urls);
    };

    transaction.onabort = reject;
  });
}

function expireExtraEntries(db, maxEntries) {
  // Bail out early by resolving with an empty array if we're not using
  // maxEntries.
  if (!maxEntries) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    let urls = [];

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index(USED_TIMESTAMP_PROP);

    const countRequest = index.count();
    countRequest.onsuccess = () => {
      const initialCount = countRequest.result;

      if (initialCount > maxEntries) {
        index.openCursor(null, 'prev').onsuccess = (cursorEvent) => {
          const cursor = cursorEvent.target.result;
          if (cursor) {
            const url = cursor.value[URL_PROPERTY];
            urls.push(url);
            objectStore.delete(url);
            if (initialCount - urls.length > maxEntries) {
              cursor.continue();
            }
          }
        };
      }
    };

    transaction.oncomplete = () => {
      resolve(urls);
    };

    transaction.onabort = reject;
  });
}

function expireEntries(db, maxEntries, maxAgeSeconds, now) {
  return expireOldEntries(db, maxAgeSeconds, now).then((oldUrls) => {
    return expireExtraEntries(db, maxEntries).then((extraUrls) => {
      return oldUrls.concat(extraUrls);
    });
  });
}
/* ============================================================
   Study Live — db.js
   IndexedDB layer for note images (blobs live here, NOT in
   localStorage — removes the ~5MB ceiling). Falls back to
   dataURLs inside localStorage when IDB is unavailable
   (private mode / old browsers): note.images entries are
   either an image id (IDB) or a 'data:...' string (fallback).
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});

  var DB_NAME = 'studyLive';
  var STORE = 'images';
  var available = !!(root.indexedDB && root.IDBKeyRange);

  var openPromise = null;
  var urlCache = {}; // id -> objectURL (session lifetime)

  function open() {
    if (!openPromise) {
      openPromise = new Promise(function (resolve, reject) {
        var req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE);
          }
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    }
    return openPromise;
  }

  function requestAsPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function withStore(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(STORE, mode);
        } catch (e) {
          reject(e);
          return;
        }
        var out;
        try {
          out = fn(tx.objectStore(STORE));
        } catch (e) {
          reject(e);
          return;
        }
        Promise.resolve(out).then(resolve, reject);
      });
    });
  }

  var db = {
    get available() {
      return available;
    },

    init: function () {
      return available ? open().then(function () { return true; }) : Promise.resolve(false);
    },

    putImage: function (id, blob) {
      if (!available) return Promise.resolve(false);
      return withStore('readwrite', function (store) {
        return requestAsPromise(store.put(blob, id));
      });
    },

    getImage: function (id) {
      if (!available) return Promise.resolve(null);
      return withStore('readonly', function (store) {
        return requestAsPromise(store.get(id));
      });
    },

    deleteImage: function (id) {
      if (!available) return Promise.resolve(false);
      delete urlCache[id];
      return withStore('readwrite', function (store) {
        return requestAsPromise(store['delete'](id));
      });
    },

    clearImages: function () {
      if (!available) return Promise.resolve(false);
      urlCache = {};
      return withStore('readwrite', function (store) {
        return requestAsPromise(store.clear());
      });
    },

    /* Stable display URL for an image id (objectURL, with a
       FileReader dataURL fallback for environments without
       createObjectURL). Returns Promise<string|null>. */
    urlFor: function (id) {
      if (!available || !id) return Promise.resolve(null);
      if (urlCache[id]) return Promise.resolve(urlCache[id]);
      return db.getImage(id).then(function (blob) {
        if (!blob) return null;
        var url = null;
        try {
          url = root.URL.createObjectURL(blob);
        } catch (e) {
          url = null;
        }
        if (!url) {
          return SL.utils.blobToDataURL(blob).then(function (dataUrl) {
            urlCache[id] = dataUrl;
            return dataUrl;
          });
        }
        urlCache[id] = url;
        return url;
      });
    },
  };

  SL.db = db;
})(typeof window !== 'undefined' ? window : globalThis);

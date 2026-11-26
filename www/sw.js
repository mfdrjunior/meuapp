var CACHE_NAME = "folha-qru-v3";
var ARQUIVOS_OFFLINE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./fundo.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ARQUIVOS_OFFLINE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  if (url.indexOf("openstreetmap.org") > -1 || url.indexOf("whatsapp.com") > -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        var resClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('static').then((cache) => {
      return cache.addAll([
        '/favicon.ico',
        '/icon.png',
        '/javascript/chat.js',
        '/javascript/peer.js',
        '/javascript/stream.js',
        '/javascript/viewer.js',
        '/stylesheets/main.css',
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  console.log(e.request.url);
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

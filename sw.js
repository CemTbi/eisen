// Offline support: the app shell is cached on install and served from cache.
// Every request is revalidated in the background, so a new version is picked
// up on the launch after it was published.
const CACHE = 'eisen-v6';

const ASSETS = [
  './',
  'styles.css',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'js/app.js',
  'js/appearance.js',
  'js/chart.js',
  'js/components.js',
  'js/editor.js',
  'js/figure.js',
  'js/i18n.js',
  'js/library.js',
  'js/model.js',
  'js/picker.js',
  'js/router.js',
  'js/stats.js',
  'js/store.js',
  'js/ui.js',
  'js/util.js',
  'js/wheel.js',
  'js/locales/de.js',
  'js/locales/en.js',
  'js/views/entry.js',
  'js/views/exercises.js',
  'js/views/home.js',
  'js/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('eisen-') && key !== CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The app is a single document; every in-scope page load gets the shell.
  const isShell = request.mode === 'navigate' && /(\/|\/index\.html)$/.test(url.pathname);
  const key = isShell ? './' : url.pathname;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const refresh = fetch(key, { cache: 'no-cache' }).then((response) => {
      if (response.ok && response.type === 'basic') cache.put(key, response.clone());
      return response;
    });
    if (!cached) return refresh;
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  })());
});

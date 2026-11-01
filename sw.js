/* Cache-first shell with background revalidation.
   The page is painted from cache; a successful network response replaces it
   for the next launch. Navigations never wait on the network when a cached
   shell exists. sw.js itself is not cached here so the browser can see deploys. */
const CACHE = 'dts-calc-v1';

const SHELL = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/manifest.json',
    '/js/calculator.js',
    '/js/normalize.js',
    '/js/convert.js',
    '/js/viewport-lock.js',
    '/js/multi-pace.js',
    '/js/gpx.js',
    '/assets/fonts/jetbrains-mono-latin.woff2',
    '/assets/icon.svg',
    '/assets/dts-calc-favicon.svg',
    '/assets/dts-calc-favicon-32.png',
    '/assets/dts-calc-favicon-16.png',
    '/assets/home-screen-icon.svg',
    '/assets/apple-touch-icon.png',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/assets/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(SHELL))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

function offlineResponse() {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname === '/sw.js') return;

    const updatePromise = fetch(request)
        .then(async (response) => {
            if (response && response.ok && response.type === 'basic') {
                const cache = await caches.open(CACHE);
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    event.waitUntil(updatePromise.then(() => undefined));
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await updatePromise;
        if (response) return response;
        if (request.mode === 'navigate') {
            return (await cache.match('/index.html'))
                || (await cache.match('/'))
                || offlineResponse();
        }
        return offlineResponse();
    })());
});

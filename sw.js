/* Cache-first shell. One cache holds one complete build.
   A navigation is served entirely from the cache it was pinned to, including
   scripts that load later (Multi). Revalidation fetches the whole shell with
   cache:'no-cache' into a new cache and publishes that cache only for a
   later navigation. The build hash below is stamped by scripts/stamp-sw.mjs. */
const BUILD = 'ec4cfcd91f0ecc0221f3';
const META = 'dts-calc-meta';
const ACTIVE_KEY = '/active';
const REFRESH = 'X-DTS-Refresh';

const SHELL = [
    '/',
    '/index.html',
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

const SHELL_PATHS = new Set(SHELL);
const pins = new Map();
let pinnedNavigation = null;
let revalidateTask = Promise.resolve();

function cacheName(hash) {
    return `dts-calc-${hash}`;
}

function offlineResponse() {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}

async function hashShell(entries) {
    const parts = [];
    const encoder = new TextEncoder();
    for (const entry of entries) {
        parts.push(encoder.encode(entry.path));
        parts.push(new Uint8Array([0]));
        parts.push(entry.body instanceof ArrayBuffer ? new Uint8Array(entry.body) : entry.body);
        parts.push(new Uint8Array([0]));
    }
    let length = 0;
    for (const part of parts) length += part.byteLength;
    const merged = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        merged.set(part, offset);
        offset += part.byteLength;
    }
    const digest = await crypto.subtle.digest('SHA-256', merged);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

async function readActive() {
    const meta = await caches.open(META);
    const response = await meta.match(ACTIVE_KEY);
    if (!response) return cacheName(BUILD);
    const name = (await response.text()).trim();
    return name || cacheName(BUILD);
}

async function writeActive(name) {
    const meta = await caches.open(META);
    await meta.put(ACTIVE_KEY, new Response(name));
}

async function deleteUnused(keep) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
        if (!name.startsWith('dts-calc-') || keep.has(name)) return Promise.resolve();
        return caches.delete(name);
    }));
}

async function loadShell() {
    const items = [];
    for (const path of SHELL) {
        const response = await fetch(path, { cache: 'no-cache', headers: { [REFRESH]: '1' } });
        if (!response.ok) throw new Error(`shell ${path} ${response.status}`);
        const type = response.headers.get('content-type') || 'application/octet-stream';
        const bytes = await response.arrayBuffer();
        items.push({ path, body: bytes, type });
    }
    return items;
}

async function storeShell(name, items) {
    const cache = await caches.open(name);
    for (const item of items) {
        await cache.put(item.path, new Response(item.body, {
            headers: { 'Content-Type': item.type },
        }));
    }
    const keys = await cache.keys();
    if (keys.length < SHELL.length) {
        await caches.delete(name);
        throw new Error('incomplete shell');
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const items = await loadShell();
        const hash = await hashShell(items);
        if (hash !== BUILD) throw new Error(`shell hash ${hash} != ${BUILD}`);
        await storeShell(cacheName(BUILD), items);
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const name = cacheName(BUILD);
        await writeActive(name);
        await deleteUnused(new Set([name, META]));
    })());
});

function remember(id, name) {
    if (id) pins.set(id, name);
    pinnedNavigation = name;
}

function pinnedFor(event) {
    if (event.clientId && pins.has(event.clientId)) return pins.get(event.clientId);
    if (event.resultingClientId && pins.has(event.resultingClientId)) return pins.get(event.resultingClientId);
    return null;
}

async function fromCache(name, request, url) {
    const cache = await caches.open(name);
    const cached = await cache.match(request) || await cache.match(url.pathname);
    if (cached) return cached;
    if (request.mode === 'navigate') {
        return (await cache.match('/index.html'))
            || (await cache.match('/'))
            || offlineResponse();
    }
    if (SHELL_PATHS.has(url.pathname)) return offlineResponse();
    try {
        return await fetch(request);
    } catch {
        return offlineResponse();
    }
}

function revalidateShell(protect) {
    const run = revalidateTask.then(() => revalidateShellOnce(protect));
    revalidateTask = run.catch(() => {});
    return run;
}

async function cachesInUse(protect) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    const ids = new Set(clients.map((client) => client.id));
    const keep = new Set();
    if (protect) keep.add(protect);
    for (const [id, name] of pins) {
        if (ids.has(id)) keep.add(name);
        else pins.delete(id);
    }
    return keep;
}

async function revalidateShellOnce(protect) {
    let items;
    try {
        items = await loadShell();
    } catch {
        return;
    }
    const hash = await hashShell(items);
    const name = cacheName(hash);
    const current = await readActive();
    if (name !== current) {
        try {
            await storeShell(name, items);
        } catch {
            return;
        }
        await writeActive(name);
    }
    const keep = new Set([name, META, ...(await cachesInUse(protect))]);
    await deleteUnused(keep);
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (request.headers.get(REFRESH) === '1') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname === '/sw.js') return;

    event.respondWith((async () => {
        let name = pinnedFor(event);
        if (request.mode === 'navigate' || !name) {
            if (request.mode === 'navigate') {
                name = await readActive();
                remember(event.resultingClientId || event.clientId, name);
                const published = name;
                try {
                    event.waitUntil(revalidateShell(published));
                } catch {
                    revalidateShell(published);
                }
            } else {
                name = pinnedNavigation || await readActive();
                if (event.clientId) pins.set(event.clientId, name);
            }
        }
        return fromCache(name, request, url);
    })());
});

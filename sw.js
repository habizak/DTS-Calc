/* Cache-first shell. One cache holds one complete build.
   Cached HTML points scripts and the font at /b/<hash>/... so a page can
   only request that build's files, including after this worker process is
   stopped and started again. Icons and the manifest keep stable URLs.
   A navigation publishes a newly fetched shell only for a later navigation.
   If the current build cache is missing, the response comes from the network
   and the refresh stores it again. Client ids are stored in the meta cache
   so activate can keep a build an open page still needs; that map is not
   used to choose which build a script comes from. The build hash below is
   stamped by scripts/stamp-sw.mjs. */
const BUILD = 'e5e53261116d9f676873';
const META = 'dts-calc-meta';
const ACTIVE_KEY = '/active';
const CLIENTS_KEY = '/clients';
const REFRESH = 'X-DTS-Refresh';
const BOOT = crypto.randomUUID();

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
let stateTask = Promise.resolve();

function cacheName(hash) {
    return `dts-calc-${hash}`;
}

function enqueue(task) {
    const run = stateTask.then(task, task);
    stateTask = run.then(() => {}, () => {});
    return run;
}

function offlineResponse() {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain', 'X-DTS-Boot': BOOT } });
}

function tag(response) {
    const headers = new Headers(response.headers);
    headers.set('X-DTS-Boot', BOOT);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function parseBuildPath(pathname) {
    const match = /^\/b\/([0-9a-f]{20})(\/(?:js|assets)\/[^?#]+|\/manifest\.json)$/.exec(pathname);
    if (!match || match[2].includes('..')) return null;
    return { hash: match[1], path: match[2] };
}

function stampDocument(body, hash) {
    const prefix = `/b/${hash}`;
    const html = new TextDecoder().decode(body);
    return new TextEncoder().encode(
        html
            .replaceAll('src="js/', `src="${prefix}/js/`)
            .replaceAll('url("/assets/', `url("${prefix}/assets/`),
    );
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

async function readPins() {
    const meta = await caches.open(META);
    const response = await meta.match(CLIENTS_KEY);
    if (!response) return {};
    try {
        const data = JSON.parse(await response.text());
        return data && typeof data === 'object' ? data : {};
    } catch {
        return {};
    }
}

async function writePins(pins) {
    const meta = await caches.open(META);
    await meta.put(CLIENTS_KEY, new Response(JSON.stringify(pins), {
        headers: { 'Content-Type': 'application/json' },
    }));
}

async function rememberPin(id, name) {
    const pins = await readPins();
    pins[id] = name;
    await writePins(pins);
}

async function ensurePin(id, name) {
    const pins = await readPins();
    if (pins[id]) return;
    pins[id] = name;
    await writePins(pins);
}

async function deleteUnused(keep) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
        if (!name.startsWith('dts-calc-') || keep.has(name)) return Promise.resolve();
        return caches.delete(name);
    }));
}

async function pruneCaches(protectName) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    const active = await readActive();
    if (clients.length === 0) {
        await writePins({});
        await deleteUnused(new Set([META, active]));
        return;
    }
    const ids = new Set(clients.map((client) => client.id));
    const pins = await readPins();
    const keep = new Set([META, active, protectName]);
    for (const [id, name] of Object.entries(pins)) {
        if (ids.has(id)) keep.add(name);
        else delete pins[id];
    }
    await writePins(pins);
    await deleteUnused(keep);
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
    const hash = name.slice('dts-calc-'.length);
    const cache = await caches.open(name);
    for (const item of items) {
        let body = item.body;
        if (item.path === '/' || item.path === '/index.html') body = stampDocument(body, hash);
        await cache.put(item.path, new Response(body, {
            headers: { 'Content-Type': item.type },
        }));
    }
    const keys = await cache.keys();
    if (keys.length < SHELL.length) {
        await caches.delete(name);
        throw new Error('incomplete shell');
    }
}

async function fromNetwork(path) {
    try {
        const response = await fetch(path, { cache: 'no-cache', headers: { [REFRESH]: '1' } });
        if (response.ok) return response;
    } catch {
        /* offline */
    }
    return offlineResponse();
}

async function fromCache(name, path) {
    if (!(await caches.has(name))) return fromNetwork(path);
    const cache = await caches.open(name);
    const cached = await cache.match(path)
        || (path === '/' ? await cache.match('/index.html') : null)
        || (path === '/index.html' ? await cache.match('/') : null);
    return cached ? tag(cached) : offlineResponse();
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
    event.waitUntil(enqueue(async () => {
        const name = cacheName(BUILD);
        await writeActive(name);
        await pruneCaches(name);
    }));
});

async function revalidateShellOnce(protectName) {
    let items;
    try {
        items = await loadShell();
    } catch {
        return;
    }
    const hash = await hashShell(items);
    const name = cacheName(hash);
    const current = await readActive();
    if (name !== current || !(await caches.has(name))) {
        try {
            await storeShell(name, items);
        } catch {
            return;
        }
        await writeActive(name);
    }
    await pruneCaches(protectName || name);
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (request.headers.get(REFRESH) === '1') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname === '/sw.js') return;

    const build = parseBuildPath(url.pathname);
    if (build) {
        const name = cacheName(build.hash);
        if (event.clientId) event.waitUntil(enqueue(() => ensurePin(event.clientId, name)));
        event.respondWith(fromCache(name, build.path));
        return;
    }

    const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
    if (navigation) {
        const path = url.pathname === '/index.html' ? '/index.html' : '/';
        const job = (async () => {
            const name = await readActive();
            const id = event.resultingClientId || event.clientId;
            if (id) await enqueue(() => rememberPin(id, name));
            return { name, response: await fromCache(name, path) };
        })();
        event.respondWith(job.then((result) => result.response));
        event.waitUntil(job.then(({ name }) => enqueue(() => revalidateShellOnce(name))));
        return;
    }

    if (SHELL_PATHS.has(url.pathname)) {
        event.respondWith((async () => {
            const pins = await readPins();
            const named = event.clientId ? pins[event.clientId] : '';
            if (named) return fromCache(named, url.pathname);
            if (url.pathname.startsWith('/js/')) return offlineResponse();
            return fromCache(await readActive(), url.pathname);
        })());
    }
});

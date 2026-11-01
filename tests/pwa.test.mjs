import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from 'playwright';
import { SHELL, hashShell } from '../scripts/shell-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium, webkit } = playwright;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};

const MARKERS = {
    '/js/calculator.js': 'calculator',
    '/js/multi-pace.js': 'multi',
    '/js/gpx.js': 'gpx',
};

function applyRevision(path, body, revision) {
    if (path === '/' || path === '/index.html') {
        return Buffer.from(body.toString('utf8').replaceAll('content="local"', `content="${revision}"`));
    }
    const key = MARKERS[path];
    if (!key) return body;
    return Buffer.concat([
        body,
        Buffer.from(`\nglobalThis.__dtsRev=Object.assign(globalThis.__dtsRev||{},{${key}:${JSON.stringify(revision)}});\n`),
    ]);
}

let shellRevision = 'A';
let swSuffix = '';
/** @type {import('node:http').Server} */
let server;
let base;

function listen() {
    server = createServer(async (request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const relative = pathname.replace(/^\/+/, '');
        const filePath = normalize(join(root, relative));
        if (!filePath.startsWith(root)) {
            response.writeHead(403);
            response.end();
            return;
        }
        try {
            if (relative === 'sw.js') {
                const entries = [];
                for (const path of SHELL) {
                    const shellRelative = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
                    const shellBody = applyRevision(path, await readFile(join(root, shellRelative)), shellRevision);
                    entries.push({ path, body: shellBody });
                }
                const source = (await readFile(filePath, 'utf8')).replace(
                    /const BUILD = '[0-9a-f]+';/,
                    `const BUILD = '${hashShell(entries)}';`,
                );
                response.writeHead(200, {
                    'Content-Type': 'text/javascript; charset=utf-8',
                    'Cache-Control': 'no-cache',
                });
                response.end(source + swSuffix);
                return;
            }
            let body = applyRevision(url.pathname === '/' ? '/' : url.pathname, await readFile(filePath), shellRevision);
            const cacheControl = 'public, max-age=0, must-revalidate';
            response.writeHead(200, {
                'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream',
                'Cache-Control': cacheControl,
            });
            response.end(body);
        } catch {
            response.writeHead(404);
            response.end('missing');
        }
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            base = `http://127.0.0.1:${address.port}/`;
            resolve();
        });
    });
}

const SLOW_4G = {
    offline: false,
    downloadThroughput: (1.6 * 1000 * 1000) / 8 * 0.9,
    uploadThroughput: (750 * 1000) / 8 * 0.9,
    latency: 150 * 3.75,
    connectionType: 'cellular4g',
};

function mobile(browserType, userAgent) {
    return browserType.launch({ headless: true }).then((browser) => browser.newContext({
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent,
        serviceWorkers: 'allow',
    }).then((context) => ({ browser, context })));
}

async function paintTimes(page) {
    await page.waitForTimeout(50);
    return page.evaluate(() => {
        const paint = performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint');
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : null;
        return {
            fcp: paint ? paint.startTime : null,
            lcp,
            shell: document.querySelector('meta[name="dts-shell"]')?.content || '',
            title: document.querySelector('.ctds-header-label')?.textContent || '',
            background: getComputedStyle(document.body).backgroundColor,
        };
    });
}

async function coldFcp(browserType, userAgent, throttle) {
    const { browser, context } = await mobile(browserType, userAgent);
    const page = await context.newPage();
    if (throttle === 'slow-4g') {
        const client = await context.newCDPSession(page);
        await client.send('Network.enable');
        await client.send('Network.emulateNetworkConditions', SLOW_4G);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    } else if (throttle === 'latency') {
        await page.route('**/*', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 563));
            await route.continue();
        });
    }
    await page.goto(base, { waitUntil: 'load', timeout: 90000 });
    const timing = await paintTimes(page);
    const google = await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('fonts.googleapis.com') || entry.name.includes('fonts.gstatic.com')));
    await browser.close();
    return { ...timing, google };
}

async function stopWorkers(context, page) {
    if (context.browser().browserType().name() === 'chromium') {
        const session = await context.newCDPSession(page);
        await session.send('ServiceWorker.enable');
        await session.send('ServiceWorker.stopAllWorkers');
        await page.waitForTimeout(100);
        return;
    }
    // WebKit has no CDP stop. Replace the running worker so its process and
    // in-memory state are gone while the page stays open.
    swSuffix = '\nself.addEventListener("install", (event) => { event.waitUntil(self.skipWaiting()); });\nself.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });\n';
    try {
        await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            await registration.update();
            await new Promise((resolve) => {
                const timer = setTimeout(resolve, 8000);
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        });
    } finally {
        swSuffix = '';
    }
}

async function until(page, fn, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await page.evaluate(fn)) return;
        await page.waitForTimeout(50);
    }
    throw new Error(`timed out waiting for ${fn.toString().slice(0, 160)}`);
}

async function installShell(context) {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await until(page, async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!(registration && registration.active);
    });
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await until(page, () => !!navigator.serviceWorker.controller);
    return page;
}

async function markers(page) {
    await page.locator('#modeMulti').click();
    await page.waitForFunction(() => {
        const rev = globalThis.__dtsRev;
        return !!(rev && rev.calculator && rev.multi && rev.gpx);
    });
    return page.evaluate(() => ({
        html: document.querySelector('meta[name="dts-shell"]').content,
        calculator: globalThis.__dtsRev.calculator,
        multi: globalThis.__dtsRev.multi,
        gpx: globalThis.__dtsRev.gpx,
        mode: document.querySelector('#modeSingle').classList.contains('is-active') ? 'before-multi' : 'multi',
    }));
}

function assertVersion(found, version) {
    assert.equal(found.html, version, JSON.stringify(found));
    assert.equal(found.calculator, version);
    assert.equal(found.multi, version);
    assert.equal(found.gpx, version);
}

async function useCalculator(page) {
    await page.locator('#distanceInput').fill('10');
    await page.locator('#distanceInput').blur();
    await page.locator('#speedInput').fill('12');
    await page.locator('#speedInput').blur();
    await page.waitForFunction(() => document.querySelector('#timeInput').value === '00:50:00');
    assert.equal(await page.locator('#paceInput').inputValue(), '05:00');
    assert.equal(await page.locator('#speedInput').inputValue(), '12.00');

    await page.locator('#imperialToggle').click();
    assert.equal((await page.locator('#distanceLabel').textContent()).trim(), 'MI');
    assert.equal((await page.locator('#speedLabel').textContent()).trim(), 'MPH');
    assert.equal((await page.locator('#paceLabel').textContent()).trim(), 'MIN/MI');
    await page.locator('#unitToggle').click();
    assert.equal((await page.locator('#distanceLabel').textContent()).trim(), 'KM');

    await page.locator('#distanceBtn').click();
    assert.equal(await page.locator('#distanceBtn').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#timeBtn').getAttribute('aria-pressed'), 'false');
    await page.locator('#speedBtn').click();
    assert.equal(await page.locator('#speedBtn').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#paceInput').getAttribute('disabled'), '');
    await page.locator('#timeBtn').click();
    assert.equal(await page.locator('#timeBtn').getAttribute('aria-pressed'), 'true');

    await page.locator('#modeMulti').click();
    await page.locator('#uploadGpxBtn').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#multiPaceApp').isVisible(), true);
    assert.equal(await page.locator('#singlePaceApp').isVisible(), false);
    await page.locator('#modeSingle').click();
    assert.equal(await page.locator('#singlePaceApp').isVisible(), true);
    assert.match(await page.locator('#modeSingle').getAttribute('class'), /is-active/);
}

describe('pwa', { concurrency: 1 }, () => {
before(async () => {
    await listen();
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

test('cold first paint no longer waits on a second stylesheet', { timeout: 120000 }, async () => {
    const chrome = await coldFcp(chromium, CHROME_UA, 'slow-4g');
    const kit = await coldFcp(webkit, IOS_UA, 'latency');
    assert.equal(chrome.google, false);
    assert.equal(kit.google, false);
    assert.equal(chrome.background, 'rgb(194, 7, 7)');
    assert.equal(kit.background, 'rgb(194, 7, 7)');
    assert.ok(chrome.fcp < 1000, `chromium cold FCP ${chrome.fcp}`);
    assert.ok(kit.fcp < 1400, `webkit cold FCP ${kit.fcp}`);
    console.log('cold', JSON.stringify({ chrome, kit }));
});

test('installed shell paints quickly while the network is stalled or offline', { timeout: 120000 }, async () => {
    for (const [name, browserType, userAgent] of [
        ['chromium', chromium, CHROME_UA],
        ['webkit', webkit, IOS_UA],
    ]) {
        const { browser, context } = await mobile(browserType, userAgent);
        try {
            const page = await installShell(context);
            await context.setOffline(true);
            await page.reload({ waitUntil: 'load', timeout: 15000 });
            const offline = await paintTimes(page);
            assert.equal(offline.title, 'DTS-Calc');
            assert.equal(offline.background, 'rgb(194, 7, 7)');
            assert.ok(offline.fcp != null && offline.fcp < 300, `${name} offline FCP ${offline.fcp}`);
            console.log(name, 'offline fcp', offline.fcp);
            await useCalculator(page);
            await context.setOffline(false);

            if (name === 'chromium') {
                const stalled = await context.newPage();
                const client = await context.newCDPSession(stalled);
                await client.send('Network.enable');
                await client.send('Network.emulateNetworkConditions', {
                    offline: false,
                    latency: 8000,
                    downloadThroughput: 10 * 1024 / 8,
                    uploadThroughput: 10 * 1024 / 8,
                });
                await stalled.goto(base, { waitUntil: 'commit', timeout: 15000 });
                await stalled.waitForSelector('.ctds-header-label', { timeout: 3000 });
                const timing = await paintTimes(stalled);
                console.log('chromium stalled fcp', timing.fcp);
                assert.ok(timing.fcp != null && timing.fcp < 300, `stalled FCP ${timing.fcp}`);
            }
        } finally {
            await browser.close();
        }
    }
});

test('a deploy stays on one shell until the second launch', { timeout: 180000 }, async () => {
    for (const [name, browserType, userAgent] of [
        ['chromium', chromium, CHROME_UA],
        ['webkit', webkit, IOS_UA],
    ]) {
        shellRevision = 'A';
        const { browser, context } = await mobile(browserType, userAgent);
        try {
            const installed = await installShell(context);
            await installed.evaluate(() => localStorage.setItem('pace-mode', 'single'));
            await installed.waitForLoadState('networkidle');
            await installed.close();

            shellRevision = 'B';
            const first = await context.newPage();
            await first.goto(base, { waitUntil: 'load', timeout: 30000 });
            assert.equal(await first.locator('meta[name="dts-shell"]').getAttribute('content'), 'A');
            assert.match(await first.locator('#modeSingle').getAttribute('class'), /is-active/);
            await until(first, async () => {
                const meta = await caches.open('dts-calc-meta');
                const pointer = await meta.match('/active');
                if (!pointer) return false;
                const cache = await caches.open((await pointer.text()).trim());
                const files = await Promise.all([
                    cache.match('/index.html'),
                    cache.match('/js/calculator.js'),
                    cache.match('/js/multi-pace.js'),
                    cache.match('/js/gpx.js'),
                ]);
                if (files.some((response) => !response)) return false;
                const text = (await Promise.all(files.map((response) => response.text()))).join('\n');
                const keys = await cache.keys();
                return keys.length >= 19
                    && text.includes('content="B"')
                    && text.includes('calculator:"B"')
                    && text.includes('multi:"B"')
                    && text.includes('gpx:"B"');
            }, 20000);
            assertVersion(await markers(first), 'A');
            await first.evaluate(() => localStorage.setItem('pace-mode', 'single'));
            await first.close();

            const second = await context.newPage();
            await second.goto(base, { waitUntil: 'load', timeout: 30000 });
            assert.match(await second.locator('#modeSingle').getAttribute('class'), /is-active/);
            assertVersion(await markers(second), 'B');
            const stale = await second.evaluate(async () => {
                const found = [];
                for (const key of await caches.keys()) {
                    const cache = await caches.open(key);
                    for (const path of ['/', '/index.html', '/js/calculator.js', '/js/multi-pace.js', '/js/gpx.js']) {
                        const response = await cache.match(path);
                        if (!response) continue;
                        const text = await response.text();
                        if (text.includes('content="A"') || text.includes('calculator:"A"') || text.includes('multi:"A"') || text.includes('gpx:"A"')) {
                            found.push(`${key} ${path}`);
                        }
                    }
                }
                return found;
            });
            assert.deepEqual(stale, []);
            await second.locator('#modeSingle').click();
            await useCalculator(second);
            console.log(name, 'deploy shells match');
        } finally {
            await browser.close();
        }
    }
});

test('a stopped worker cannot mix a newer build into an old tab', { timeout: 180000 }, async () => {
    for (const [name, browserType, userAgent] of [
        ['chromium', chromium, CHROME_UA],
        ['webkit', webkit, IOS_UA],
    ]) {
        shellRevision = 'A';
        const { browser, context } = await mobile(browserType, userAgent);
        try {
            const tabA = await installShell(context);
            await tabA.evaluate(() => localStorage.setItem('pace-mode', 'single'));
            const before = await tabA.evaluate(async () => {
                const src = document.querySelector('script[type="module"]').getAttribute('src');
                const boot = await fetch(new URL(src, location.href), { cache: 'no-store' }).then((response) => response.headers.get('x-dts-boot'));
                return { src, boot, html: document.querySelector('meta[name="dts-shell"]').content };
            });
            assert.equal(before.html, 'A');
            assert.match(before.src, /^\/b\/[0-9a-f]{20}\/js\/calculator\.js$/);
            assert.ok(before.boot, `${name} missing worker boot id`);

            shellRevision = 'B';
            const tabB = await context.newPage();
            await tabB.goto(base, { waitUntil: 'load', timeout: 30000 });
            assert.equal(await tabA.locator('meta[name="dts-shell"]').getAttribute('content'), 'A');
            await until(tabB, async () => {
                const meta = await caches.open('dts-calc-meta');
                const pointer = await meta.match('/active');
                if (!pointer) return false;
                const cache = await caches.open((await pointer.text()).trim());
                const multi = await cache.match('/js/multi-pace.js');
                return !!(multi && (await multi.text()).includes('multi:"B"'));
            }, 20000);

            await stopWorkers(context, tabA);
            const booted = await tabA.evaluate(async () => {
                const src = document.querySelector('script[type="module"]').getAttribute('src');
                const boot = await fetch(new URL(src, location.href), { cache: 'no-store' }).then((response) => response.headers.get('x-dts-boot'));
                return boot;
            });
            assert.notEqual(booted, before.boot, `${name} worker was still the same process`);
            assertVersion(await markers(tabA), 'A');
            const scripts = await tabA.evaluate(() => performance.getEntriesByType('resource')
                .map((entry) => entry.name)
                .filter((url) => /\/js\/(?:calculator|multi-pace|gpx)\.js(?:\?|$)/.test(url)));
            assert.ok(scripts.some((url) => url.includes('/js/multi-pace.js')), scripts.join('\n'));
            assert.ok(scripts.some((url) => url.includes('/js/gpx.js')), scripts.join('\n'));
            const hashes = new Set(scripts.map((url) => {
                const match = url.match(/\/b\/([0-9a-f]{20})\//);
                return match ? match[1] : url;
            }));
            assert.equal(hashes.size, 1, scripts.join('\n'));
            assert.equal([...hashes][0], before.src.split('/')[2]);
            console.log(name, 'old tab stayed on one build after worker stop');
        } finally {
            await browser.close();
        }
    }
});
});

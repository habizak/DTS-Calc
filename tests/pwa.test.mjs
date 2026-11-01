import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from 'playwright';

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

let shellRevision = 'A';
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
            let body = await readFile(filePath);
            if (pathname === '/index.html') {
                body = Buffer.from(body.toString('utf8').replace('content="local"', `content="${shellRevision}"`));
            }
            const cacheControl = pathname === '/sw.js' ? 'no-cache' : 'public, max-age=0, must-revalidate';
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

async function installShell(context) {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    return page;
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

test.before(async () => {
    await listen();
});

test.after(async () => {
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

test('a later launch picks up a new deploy and the calculator still runs', { timeout: 120000 }, async () => {
    shellRevision = 'A';
    const { browser, context } = await mobile(chromium, CHROME_UA);
    try {
        const page = await installShell(context);
        assert.equal(await page.locator('meta[name="dts-shell"]').getAttribute('content'), 'A');

        shellRevision = 'B';
        await page.reload({ waitUntil: 'load' });
        assert.equal(await page.locator('meta[name="dts-shell"]').getAttribute('content'), 'A');
        await page.waitForFunction(async () => {
            const cache = await caches.open('dts-calc-v1');
            const response = await cache.match('/');
            const html = response ? await response.text() : '';
            return html.includes('content="B"');
        }, null, { timeout: 10000 });
        await page.reload({ waitUntil: 'load' });
        assert.equal(await page.locator('meta[name="dts-shell"]').getAttribute('content'), 'B');
        await useCalculator(page);
    } finally {
        await browser.close();
    }

    const kit = await mobile(webkit, IOS_UA);
    try {
        const kitPage = await kit.context.newPage();
        await kitPage.goto(base, { waitUntil: 'load' });
        await useCalculator(kitPage);
    } finally {
        await kit.browser.close();
    }
});

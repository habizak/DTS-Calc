import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the document inlines styles and does not block on Google Fonts', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const css = (await readFile(new URL('../css/styles.css', import.meta.url), 'utf8')).replace(/\s+$/, '');
    const match = html.match(/<style id="app-css">\n([\s\S]*?)\n<\/style>/);
    assert.ok(match, 'index.html is missing the inlined stylesheet');
    assert.equal(match[1], css);
    assert.equal(html.includes('fonts.googleapis.com'), false);
    assert.equal(html.includes('fonts.gstatic.com'), false);
    assert.equal(html.includes('rel="stylesheet"'), false);
    assert.match(css, /font-display:\s*swap/);
    assert.match(css, /\/assets\/fonts\/jetbrains-mono-latin\.woff2/);
});

test('manifest scope covers start_url and the worker is cache-first', async () => {
    const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');

    const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
    assert.match(sw, /const CACHE = 'dts-calc-v1'/);
    assert.match(sw, /skipWaiting/);
    assert.match(sw, /caches\.delete/);
    assert.equal(sw.includes('location.reload'), false);
    const cachedReturn = sw.indexOf('if (cached) return cached');
    const waitForNetwork = sw.indexOf('const response = await updatePromise');
    assert.ok(cachedReturn > 0 && cachedReturn < waitForNetwork);

    const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    const swHeader = vercel.headers.find((entry) => entry.source === '/sw.js');
    assert.equal(swHeader.headers[0].key, 'Cache-Control');
    assert.equal(swHeader.headers[0].value, 'no-cache');
});

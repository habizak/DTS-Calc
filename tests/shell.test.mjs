import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHELL, hashShell, readShellEntries } from '../scripts/shell-hash.mjs';

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
    const entries = await readShellEntries();
    const hash = hashShell(entries);
    assert.match(sw, new RegExp(`const BUILD = '${hash}'`));
    assert.equal(sw.includes('dts-calc-v1'), false);
    assert.equal(sw.includes('/css/styles.css'), false);
    assert.equal(SHELL.includes('/css/styles.css'), false);
    const listed = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    assert.deepEqual(listed, SHELL);
    const changed = entries.map((entry, index) => index === 0
        ? { path: entry.path, body: Buffer.concat([entry.body, Buffer.from('changed')]) }
        : entry);
    assert.notEqual(hashShell(changed), hash);
    assert.match(sw, /caches\.delete/);
    assert.match(sw, /cache:\s*'no-cache'/);
    assert.equal(sw.includes('skipWaiting'), false);
    assert.equal(sw.includes('clients.claim'), false);
    assert.equal(sw.includes('location.reload'), false);
    assert.match(await readFile(new URL('../css/styles.css', import.meta.url), 'utf8'), /font-weight:\s*400 800/);

    const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    const swHeader = vercel.headers.find((entry) => entry.source === '/sw.js');
    assert.equal(swHeader.headers[0].key, 'Cache-Control');
    assert.equal(swHeader.headers[0].value, 'no-cache');
});

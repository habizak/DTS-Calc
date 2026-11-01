import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHELL, hashShell, readShellEntries } from '../scripts/shell-hash.mjs';
import { inlineCss } from '../scripts/inline-css.mjs';

test('inlining css detects the style tag and leaves an up-to-date page unchanged', () => {
    const html = '<style id="app-css">\nold\n</style>';
    const once = inlineCss(html, 'new');
    assert.equal(once, '<style id="app-css">\nnew\n</style>');
    assert.equal(inlineCss(once, 'new'), once);
    assert.throws(() => inlineCss('<head></head>', 'new'), /app-css/);
});

test('the build stamps sw.js before a deploy', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.scripts.build, /scripts\/inline-css\.mjs/);
    assert.match(pkg.scripts.build, /scripts\/stamp-sw\.mjs/);
    const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.equal(vercel.buildCommand, 'npm run build');
});

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
    assert.match(sw, /caches\.has/);
    assert.match(sw, /cache:\s*'no-cache'/);
    assert.equal(sw.includes('pinnedNavigation'), false);
    assert.equal(sw.includes('new Map('), false);
    assert.match(sw, /\/b\//);
    assert.match(sw, /CLIENTS_KEY/);
    assert.equal(sw.includes('skipWaiting'), false);
    assert.equal(sw.includes('clients.claim'), false);
    assert.equal(sw.includes('location.reload'), false);
    assert.match(await readFile(new URL('../css/styles.css', import.meta.url), 'utf8'), /font-weight:\s*400 800/);

    const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    const swHeader = vercel.headers.find((entry) => entry.source === '/sw.js');
    assert.equal(swHeader.headers[0].key, 'Cache-Control');
    assert.equal(swHeader.headers[0].value, 'no-cache');
    const buildRewrite = vercel.rewrites.find((entry) => entry.source === '/b/:hash/:path*');
    assert.equal(buildRewrite.destination, '/:path*');
    assert.equal(vercel.rewrites.some((entry) => entry.source === '/' && entry.destination === '/index.html'), true);
});

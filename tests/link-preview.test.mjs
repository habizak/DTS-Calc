import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitDist } from '../scripts/emit-dist.mjs';
import { LINK_PREVIEW, applyLinkPreview, linkPreviewTags } from '../scripts/link-preview.mjs';
import { SHELL } from '../scripts/shell-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const COVER_SHA256 = '728775ceb03974599c3acd8b27f01c604eb5f6812f1ac7bf2e57c323ffbb6554';

function sha256(body) {
    return createHash('sha256').update(body).digest('hex');
}

test('link preview copy is the approved wording', () => {
    assert.equal(LINK_PREVIEW.title, 'DTS-Calc: a simple running calculator');
    assert.equal(LINK_PREVIEW.description, 'Work out how long a run will take, or the pace you need. No clutter.');
    assert.equal(LINK_PREVIEW.imageAlt, 'The DTS-Calc icon, two pixel arrows pointing opposite ways, in white on red.');
    assert.equal(LINK_PREVIEW.siteName, 'DTS-Calc');
    assert.equal(LINK_PREVIEW.url, 'https://dts-calc.vercel.app');
    assert.equal(LINK_PREVIEW.image, 'https://dts-calc.vercel.app/og.png');
});

test('index.html keeps its title and includes the preview tags from the one copy source', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.equal(applyLinkPreview(html), html);
    assert.match(html, /<title>DTS-Calc<\/title>/);
    const tags = linkPreviewTags();
    assert.ok(html.includes(tags), 'index.html is missing the link-preview tags');
    assert.equal(html.includes('fonts.googleapis.com'), false);
});

test('og.png is the approved cover and is published at /og.png outside the shell', async () => {
    const source = await readFile(join(root, 'public/og.png'));
    assert.equal(source.length, 3767);
    assert.equal(sha256(source), COVER_SHA256);
    assert.equal(SHELL.includes('/og.png'), false);

    const dist = await mkdtemp(join(tmpdir(), 'dts-og-'));
    try {
        await emitDist(dist);
        const published = await readFile(join(dist, 'og.png'));
        assert.equal(sha256(published), COVER_SHA256);
        const built = await readFile(join(dist, 'index.html'), 'utf8');
        assert.ok(built.includes(linkPreviewTags()));
    } finally {
        await rm(dist, { recursive: true, force: true });
    }
});

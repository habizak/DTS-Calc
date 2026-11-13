import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/js/calculator.js',
    '/js/normalize.js',
    '/js/convert.js',
    '/js/viewport-lock.js',
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

export function hashShell(entries) {
    const hash = createHash('sha256');
    for (const entry of entries) {
        hash.update(entry.path);
        hash.update('\0');
        hash.update(entry.body);
        hash.update('\0');
    }
    return hash.digest('hex').slice(0, 20);
}

export async function readShellEntries(root = fileURLToPath(new URL('..', import.meta.url))) {
    const entries = [];
    for (const path of SHELL) {
        const relative = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
        const body = await readFile(join(root, relative));
        entries.push({ path, body });
    }
    return entries;
}

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHELL } from './shell-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// Published at the dist path, read from another repo path.
// og.png is a crawler asset, not part of the app shell.
const RENAMED = new Map([
    ['og.png', 'public/og.png'],
]);

export function deployFiles() {
    const files = new Set(['sw.js', 'assets/fonts/OFL.txt', ...RENAMED.keys()]);
    for (const path of SHELL) {
        files.add(path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
    }
    return [...files];
}

export async function emitDist(target = join(root, 'dist')) {
    await rm(target, { recursive: true, force: true });
    for (const relative of deployFiles()) {
        const source = RENAMED.get(relative) ?? relative;
        const destination = join(target, relative);
        await mkdir(dirname(destination), { recursive: true });
        await cp(join(root, source), destination);
    }
}

function isDirectRun() {
    const entry = process.argv[1];
    return !!entry && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
    await emitDist();
}

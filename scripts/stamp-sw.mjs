import { readFileSync, writeFileSync } from 'node:fs';
import { hashShell, readShellEntries } from './shell-hash.mjs';

const hash = hashShell(await readShellEntries());
const swPath = new URL('../sw.js', import.meta.url);
const source = readFileSync(swPath, 'utf8');
const next = source.replace(/const BUILD = '[0-9a-f]+';/, `const BUILD = '${hash}';`);

if (next === source && !source.includes(`const BUILD = '${hash}';`)) {
    throw new Error('sw.js is missing const BUILD');
}

writeFileSync(swPath, next);
console.log(hash);

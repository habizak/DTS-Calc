// First-load JavaScript budget. Usage: node tools/check size <app-dir> [--route /] [--update]
// Needs a finished build (npm run build). Starts `next start`, fetches the route, adds up the gzip size of every script
// the HTML loads (script tags and script preloads under /_next/static), and compares it with the app's budget in
// .monoform/size-budget.json. The budget belongs to the app: seeded once by the sync, raised only by a deliberate change in a PR.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const BUDGET_FILE = '.monoform/size-budget.json';

/** The scripts a page loads on first paint: script src and preload-as-script hrefs under /_next/static, once each. */
export function extractScripts(html) {
  const urls = new Set();
  // Scripts marked nomodule are the legacy polyfills: current browsers never download them, so they are not first-load cost.
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) if (!/\bnomodule\b/i.test(m[0])) urls.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    if (/\brel="(?:preload|modulepreload)"/.test(m[0]) && /\bas="script"|rel="modulepreload"/.test(m[0])) { const h = /\bhref="([^"]+)"/.exec(m[0]); if (h) urls.add(h[1]); }
  }
  // A deployment id (?dpl=...) must not make one file count twice.
  return [...new Set([...urls].map((u) => u.split('?')[0]))].filter((u) => u.startsWith('/_next/static/') && u.endsWith('.js'));
}

export function sizes(dir, urls) {
  let raw = 0, gz = 0; const files = [];
  for (const u of urls) {
    const buf = readFileSync(join(dir, '.next', u.slice('/_next/'.length)));
    const g = gzipSync(buf).length; raw += buf.length; gz += g; files.push({ url: u, raw: buf.length, gzip: g });
  }
  return { raw, gzip: gz, files };
}

export function evaluate(gzipBytes, budgetKB) {
  const kb = gzipBytes / 1024;
  return { kb: Math.round(kb * 10) / 10, budgetKB, ok: kb <= budgetKB, headroomKB: Math.round((budgetKB - kb) * 10) / 10 };
}

const freePort = () => new Promise((res, rej) => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

export async function measureApp(dir, route = '/') {
  if (!existsSync(join(dir, '.next', 'BUILD_ID'))) throw new Error(`${dir}: no finished build (.next/BUILD_ID). Run npm run build first.`);
  const port = await freePort();
  const child = spawn('npx', ['next', 'start', '-p', String(port)], { cwd: dir, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production' } });
  try {
    let html = '';
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}${route}`); if (r.ok) { html = await r.text(); break; } } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!html) throw new Error(`${dir}: next start did not answer on ${route}`);
    return sizes(dir, extractScripts(html));
  } finally { child.kill('SIGTERM'); }
}

export async function runSize({ dir, route = '/', update = false, quiet = false } = {}) {
  if (!dir) { console.log('usage: node tools/check size <app-dir> [--route /] [--update]'); return { ok: false }; }
  const app = basename(dir.replace(/\/+$/, ''));
  const m = await measureApp(dir, route); const path = join(dir, BUDGET_FILE);
  if (update) { const budget = Math.ceil((m.gzip / 1024) * 1.1 / 5) * 5; writeFileSync(path, JSON.stringify({ firstLoadGzipKB: budget, route, note: 'About 10% above the size when this was set. Raise it only on purpose, in a PR, with a reason.' }, null, 2) + '\n'); if (!quiet) console.log(`${app}: budget written, ${budget} KB gzip for ${route}`); }
  if (!existsSync(path)) { if (!quiet) console.log(`${app}: ${(m.gzip / 1024).toFixed(1)} KB gzip, ${(m.raw / 1024).toFixed(0)} KB raw first-load JS for ${route}. No ${BUDGET_FILE} yet (run with --update).`); return { ok: true, m }; }
  const budget = JSON.parse(readFileSync(path, 'utf8')); const r = evaluate(m.gzip, budget.firstLoadGzipKB);
  if (!quiet) { console.log(`${app}: first-load JS for ${route}: ${r.kb} KB gzip (${(m.raw / 1024).toFixed(0)} KB raw, ${m.files.length} scripts), budget ${r.budgetKB} KB, ${r.ok ? `${r.headroomKB} KB headroom` : `OVER by ${-r.headroomKB} KB`}`); if (!r.ok) for (const f of [...m.files].sort((a, b) => b.gzip - a.gzip).slice(0, 5)) console.log(`  ${(f.gzip / 1024).toFixed(1)} KB gzip  ${f.url}`); }
  return { ok: r.ok, m, r };
}

// Run directly, so an app can use its synced copy: node .monoform/tools/size.mjs . [--route /] [--update]
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const i = args.indexOf('--route');
  const r = await runSize({ dir: args.find((a, n) => !a.startsWith('--') && args[n - 1] !== '--route') || '.', route: i >= 0 ? args[i + 1] : '/', update: args.includes('--update') });
  process.exit(r.ok ? 0 : 1);
}

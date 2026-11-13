/**
 * After `next build`, write public/sw-precache.json from the build manifests.
 * The file is gitignored: chunk hashes change every build. The service worker
 * fetches it on install and precaches those URLs with the HTML shell.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collectPrecacheUrls, precacheSizeReport, stampServiceWorker } from '../lib/pure/swPrecacheManifest.mjs'

const ROOT = process.cwd()
const NEXT = path.join(ROOT, '.next')

async function readJson(relativePath) {
  try {
    const text = await readFile(path.join(ROOT, relativePath), 'utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

const STATIC_ASSET = /\.(js|mjs|css|woff2|woff|ttf|otf|ts)$/

/** Every client asset under .next/static, including lazy chunks and the pairing worker. */
async function staticAssetFiles(dir) {
  const found = []
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await staticAssetFiles(full)))
    } else if (STATIC_ASSET.test(entry.name) && !entry.name.endsWith('.map')) {
      const rel = path.relative(path.join(NEXT, 'static'), full).split(path.sep).join('/')
      found.push(`static/${rel}`)
    }
  }
  return found
}

async function cssFiles(dir) {
  const found = []
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await cssFiles(full)))
    } else if (entry.name.endsWith('.css')) {
      const rel = path.relative(path.join(NEXT, 'static'), full).split(path.sep).join('/')
      found.push(`static/${rel}`)
    }
  }
  return found
}

function fontFiles(manifest) {
  const files = []
  if (!manifest || typeof manifest !== 'object') return files
  for (const group of [manifest.app, manifest.pages]) {
    if (!group || typeof group !== 'object') continue
    for (const list of Object.values(group)) {
      if (!Array.isArray(list)) continue
      for (const file of list) files.push(file)
    }
  }
  return files
}

function routeChunkPaths(stats) {
  if (!Array.isArray(stats)) return []
  const paths = []
  for (const route of stats) {
    if (!route || !Array.isArray(route.firstLoadChunkPaths)) continue
    if (route.route !== '/') continue
    paths.push(...route.firstLoadChunkPaths)
  }
  return paths
}

const buildManifest = await readJson('.next/build-manifest.json')
const fontManifest = await readJson('.next/server/next-font-manifest.json')
const routeStats = await readJson('.next/diagnostics/route-bundle-stats.json')
const css = await cssFiles(path.join(NEXT, 'static', 'chunks'))
const staticFiles = await staticAssetFiles(path.join(NEXT, 'static'))

const urls = collectPrecacheUrls({
  rootMainFiles: buildManifest?.rootMainFiles,
  polyfillFiles: buildManifest?.polyfillFiles,
  routeChunkPaths: routeChunkPaths(routeStats),
  fontFiles: fontFiles(fontManifest),
  cssFiles: css,
  staticFiles,
})

const bytesByUrl = {}
for (const url of urls) {
  if (!url.startsWith('/_next/')) continue
  try {
    const info = await stat(path.join(NEXT, url.slice('/_next/'.length)))
    bytesByUrl[url] = info.size
  } catch {
    bytesByUrl[url] = 0
  }
}
const size = precacheSizeReport(urls, bytesByUrl)

const manifestText = `${JSON.stringify(urls, null, 2)}\n`
const outPath = path.join(ROOT, 'public', 'sw-precache.json')
await writeFile(outPath, manifestText)
console.log(`sw-precache: ${size.count} urls, ${size.bytes} bytes -> public/sw-precache.json`)

const swPath = path.join(ROOT, 'public', 'sw.js')
const swSource = await readFile(swPath, 'utf8')
const stamped = stampServiceWorker(swSource, manifestText)
if (stamped.includes('__STARTER_CACHE_BUILD__')) {
  throw new Error('refusing to write a service worker that still has the CACHE_BUILD placeholder')
}
const stampedBuild = stamped.match(/const CACHE_BUILD = '([0-9a-f]{16})'/)
if (!stampedBuild) throw new Error('stamped service worker is missing CACHE_BUILD')
const generatedPath = path.join(ROOT, 'public', 'sw.generated.js')
await writeFile(generatedPath, stamped)
console.log(`sw-precache: CACHE_BUILD ${stampedBuild[1]} -> public/sw.generated.js`)
if (urls.length === 0) {
  console.warn('sw-precache: no static urls found; the worker will still cache HTML after its assets load')
}

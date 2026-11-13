import { readFileSync } from 'node:fs'

declare const __STARTER_NVMRC_PATH__: string

export function parseNodeMajor(rawNodeVersion: string): number {
  const normalizedNodeVersion = rawNodeVersion.trim().replace(/^v/, '')
  const majorToken = normalizedNodeVersion.split('.')[0]

  if (!/^\d+$/.test(majorToken)) {
    throw new Error(
      `Invalid Node version in .nvmrc: ${JSON.stringify(rawNodeVersion.trim())}`,
    )
  }

  return Number(majorToken)
}

const rawNodeVersion = readFileSync(__STARTER_NVMRC_PATH__, 'utf8')
const requiredNodeMajor = parseNodeMajor(rawNodeVersion)
const runningNodeMajor = Number(process.versions.node.split('.')[0])

if (runningNodeMajor !== requiredNodeMajor) {
  const localStorageContext =
    runningNodeMajor >= 25
      ? " Node 25+ ships a stub globalThis.localStorage that shadows jsdom's."
      : ''

  throw new Error(
    `Node ${requiredNodeMajor} required (.nvmrc), running ${process.versions.node}.${localStorageContext} ` +
      'Run `nvm install` before running the test suite.',
  )
}

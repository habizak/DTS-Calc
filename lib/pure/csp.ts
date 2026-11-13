import { createHash } from 'node:crypto'
import { THEME_BOOT_SCRIPT } from './themeBootScript'

/** Header the proxy uses to hand the per-request nonce to the render. */
export const NONCE_HEADER = 'x-nonce'

/** CSP source (no quotes) for the fixed theme boot script. */
export const THEME_BOOT_SCRIPT_HASH = `sha256-${createHash('sha256').update(THEME_BOOT_SCRIPT).digest('base64')}`

export function buildCspHeader(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' '${THEME_BOOT_SCRIPT_HASH}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** 16 random bytes as base64. */
export function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
}

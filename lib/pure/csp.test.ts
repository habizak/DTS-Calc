import { describe, expect, it } from 'vitest'
import { THEME_BOOT_SCRIPT } from './themeBootScript'
import { THEME_BOOT_SCRIPT_HASH, buildCspHeader, generateNonce } from './csp'

describe('csp', () => {
  it('allows the theme boot script by hash of its exact bytes', () => {
    expect(buildCspHeader('abc', false)).toContain(`'${THEME_BOOT_SCRIPT_HASH}'`)
    expect(THEME_BOOT_SCRIPT).toContain('starter_theme')
  })
  it('uses the nonce, strict-dynamic, and no unsafe-eval in production', () => {
    const header = buildCspHeader('abc', false)
    expect(header).toContain("'nonce-abc'")
    expect(header).toContain("'strict-dynamic'")
    expect(header).not.toContain('unsafe-eval')
    expect(buildCspHeader('abc', true)).toContain("'unsafe-eval'")
  })
  it('mints a fresh 24 character nonce each time', () => {
    const a = generateNonce()
    expect(a).toHaveLength(24)
    expect(generateNonce()).not.toBe(a)
  })
})

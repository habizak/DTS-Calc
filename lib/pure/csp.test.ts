import { describe, expect, it } from 'vitest'
import { buildCspHeader, generateNonce } from './csp'

describe('csp', () => {
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

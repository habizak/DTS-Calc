import { describe, expect, it } from 'vitest'
import { LINK_PREVIEW } from './linkPreview'

// Ported from tests/link-preview.test.mjs.
describe('link preview copy', () => {
  it('is the approved wording', () => {
    expect(LINK_PREVIEW.title).toBe('DTS-Calc: a simple running calculator')
    expect(LINK_PREVIEW.description).toBe('Work out how long a run will take, or the pace you need. No clutter.')
    expect(LINK_PREVIEW.imageAlt).toBe('The DTS-Calc icon, two pixel arrows pointing opposite ways, in white on red.')
    expect(LINK_PREVIEW.siteName).toBe('DTS-Calc')
    expect(LINK_PREVIEW.url).toBe('https://dts-calc.vercel.app')
    expect(LINK_PREVIEW.image).toBe('https://dts-calc.vercel.app/og.png')
  })
})

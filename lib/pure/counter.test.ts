import { describe, expect, it } from 'vitest'
import { parseCount } from './counter'

describe('parseCount', () => {
  it.each([[null, 0], ['', 0], ['abc', 0], ['-3', 0], ['2.5', 0], ['7', 7]])('reads %j as %d', (raw, want) => {
    expect(parseCount(raw as string | null)).toBe(want)
  })
})

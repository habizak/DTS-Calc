import { describe, expect, it } from 'vitest'
import {
  normalizeDistance,
  normalizePace,
  normalizeTime,
  normalizeVelocity,
  parseDigitsToPace,
  parseDigitsToTime,
} from './normalize'

// Ported from tests/calculations.test.mjs, same cases and expected values.
describe('normalize', () => {
  it('normalizes time and pace inputs, carrying seconds and bounding values', () => {
    expect(parseDigitsToTime('123456')).toBe('12:34:56')
    expect(parseDigitsToTime('abc')).toBe(null)
    expect(parseDigitsToPace('530')).toBe('05:30')
    expect(parseDigitsToPace('5:30')).toBe(null)
    expect(normalizeTime('1:59:70')).toBe('02:00:10')
    expect(normalizePace('5:60')).toBe('06:00')
    expect(normalizePace('99:00')).toBe('20:59')
    expect(normalizeDistance('-1')).toBe('0.00')
    expect(normalizeDistance('1,5')).toBe('1.50')
    expect(normalizeVelocity('200')).toBe('99.99')
    expect(normalizeVelocity('invalid')).toBe('0.00')
  })
})

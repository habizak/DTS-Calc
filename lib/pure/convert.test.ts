import { describe, expect, it } from 'vitest'
import { convertUnits } from './convert'
import { normalizePace } from './normalize'

// Ported from tests/calculations.test.mjs, same cases and expected values.
describe('convertUnits', () => {
  it('converts distance, speed and pace in both directions', () => {
    const fields = {
      distanceInput: { value: '10' },
      speedInput: { value: '12' },
      paceInput: { value: '05:00' },
      normalizePace,
    }
    convertUnits('METRIC', 'IMPERIAL', fields)
    expect(fields.distanceInput.value).toBe('6.21')
    expect(fields.speedInput.value).toBe('7.46')
    expect(fields.paceInput.value).toBe('08:03')
    convertUnits('IMPERIAL', 'METRIC', fields)
    expect(fields.distanceInput.value).toBe('9.99') // conversion rounds the displayed values
    expect(fields.speedInput.value).toBe('12.01')
    expect(fields.paceInput.value).toBe('05:00')
  })
})

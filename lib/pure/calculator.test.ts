import { describe, expect, it } from 'vitest'
import golden from './calculator.golden.json'
import {
  type CalculatorAction,
  type CalculatorState,
  type Field,
  type Target,
  type UnitSystem,
  STORAGE_KEY,
  actionSaves,
  announcement,
  deriveView,
  initialState,
  loadState,
  reduce,
  serializeState,
} from './calculator'

const FIELDS: Field[] = ['time', 'distance', 'speed', 'pace']

type GoldenAction =
  | { t: 'type'; f: Field; value: string }
  | { t: 'blur'; f: Field }
  | { t: 'wait' }
  | { t: 'unit'; u: UnitSystem }
  | { t: 'target'; g: Target }
  | { t: 'clear' }
  | { t: 'factory' }

interface GoldenSnap {
  v: string[]
  dis: boolean[]
  lab: string[]
  tog: boolean[]
  tgt: string | null
  tc: boolean[]
  saved: string | null
}

/** Type a value, press a key, run the debounce: the same inputs the old screen received. */
function type(state: CalculatorState, field: Field, text: string, enter = false) {
  let next = reduce(state, { type: 'edit', field, value: text })
  if (enter) next = reduce(next, { type: 'blur', field })
  return next
}

describe('calculator (replay of the old PaceCalculator)', () => {
  // golden.json was recorded by running the old js/calculator.js in jsdom: 150 random action
  // sequences from different saved states. After every step it logged the field values,
  // which fields are locked, labels, active buttons and the JSON written to localStorage.
  it('matches the old behaviour after every recorded step', () => {
    let steps = 0
    for (const [index, c] of (golden as unknown as { initial: string | null; steps: { a: GoldenAction; s: GoldenSnap }[] }[]).entries()) {
      let state = loadState(c.initial)
      let saved = c.initial
      let pending = false // a debounced compute is waiting
      for (const { a, s } of c.steps) {
        const act = (action: CalculatorAction) => {
          state = reduce(state, action)
          if (actionSaves(action)) saved = serializeState(state)
        }
        if (a.t === 'type') {
          act({ type: 'edit', field: a.f, value: a.value })
          pending = true
        } else if (a.t === 'blur') {
          act({ type: 'blur', field: a.f })
          pending = false
        } else if (a.t === 'wait') {
          if (pending) act({ type: 'compute' })
          pending = false
        } else if (a.t === 'unit') {
          act({ type: 'setUnit', unit: a.u })
        } else if (a.t === 'target') {
          act({ type: 'setTarget', target: a.g })
        } else if (a.t === 'clear') {
          act({ type: 'clear' })
        } else {
          // Long press: any waiting compute fires first, then the reset, then the release clears.
          act({ type: 'factoryReset' })
          act({ type: 'clear' })
          pending = false
        }

        const view = deriveView(state)
        const where = `case ${index} step ${JSON.stringify(a)}`
        expect(FIELDS.map((f) => state.values[f]), where).toEqual(s.v)
        expect(FIELDS.map((f) => view.fields[f].disabled), where).toEqual(s.dis)
        expect(FIELDS.map((f) => view.fields[f].isTarget), where).toEqual(s.tc)
        expect([view.distanceLabel, view.speedLabel, view.paceLabel], where).toEqual(s.lab)
        expect([view.metricActive, view.imperialActive], where).toEqual(s.tog)
        expect(view.activeTarget?.toLowerCase() ?? null, where).toBe(s.tgt)
        expect(saved, where).toBe(s.saved)
        steps++
      }
    }
    expect(steps).toBe(1170)
  })
})

describe('calculator checks from CONTRIBUTING.md', () => {
  it('10 km in 50 minutes gives 12 km/h and 5:00 min/km', () => {
    let s = initialState()
    s = type(s, 'distance', '10', true)
    s = type(s, 'speed', '12', true)
    expect(s.values.time).toBe('00:50:00')
    expect(s.values.pace).toBe('05:00')
    expect(s.values.speed).toBe('12.00')
  })

  // Expected values below were read from the old js/calculator.js, not worked out by hand.
  // Switching units re-rounds the shown figures and recomputes the time, so 00:50:00 becomes 00:49:57.
  it('the same trip in Imperial gives the converted figures', () => {
    let s = initialState()
    s = type(s, 'distance', '10', true)
    s = type(s, 'speed', '12', true)
    s = reduce(s, { type: 'setUnit', unit: 'IMPERIAL' })
    expect(s.values).toEqual({ time: '00:49:57', distance: '6.21', speed: '7.46', pace: '08:03' })
    expect(deriveView(s)).toMatchObject({ distanceLabel: 'MI', speedLabel: 'MPH', paceLabel: 'MIN/MI' })
  })

  it('typing a distance in miles and a speed in mph gives the matching time and pace', () => {
    let s = reduce(initialState(), { type: 'setUnit', unit: 'IMPERIAL' })
    s = type(s, 'distance', '6.21', true)
    s = type(s, 'speed', '7.46', true)
    expect(s.values.time).toBe('00:49:57')
    expect(s.values.pace).toBe('08:03')
  })

  it('invalid input is normalized the way it was', () => {
    let s = initialState()
    s = type(s, 'distance', 'abc', true)
    expect(s.values.distance).toBe('0.00')
    s = type(s, 'speed', '200', true)
    expect(s.values.speed).toBe('99.99')
    s = type(s, 'time', '1:59:70', true)
    expect(s.values.time).toBe('02:00:10')
  })
})

describe('saved state', () => {
  it('writes the exact JSON shape that existing users already have', () => {
    const s = type(type(initialState(), 'distance', '10', true), 'speed', '12', true)
    expect(STORAGE_KEY).toBe('pace-calculator-state')
    expect(serializeState(s)).toBe(
      '{"target":"TIME","unitSystem":"METRIC","values":{"time":"00:50:00","distance":"10.00","speed":"12.00","pace":"05:00"}}',
    )
  })

  it('reads a saved value back, and falls back to defaults for unreadable data', () => {
    const saved = '{"target":"DISTANCE","unitSystem":"IMPERIAL","values":{"time":"01:00:00","speed":"7.00"}}'
    const s = loadState(saved)
    expect(s.target).toBe('DISTANCE')
    expect(s.unitSystem).toBe('IMPERIAL')
    expect(s.values).toEqual({ time: '01:00:00', distance: '', speed: '7.00', pace: '' })
    for (const bad of [null, '', 'not json', 'null']) {
      expect(loadState(bad)).toEqual(initialState())
    }
  })

  it('announces the current values for screen readers', () => {
    expect(announcement({ time: '00:50:00', distance: '', speed: '12.00', pace: '' })).toBe(
      'Updated: time 00:50:00, distance —, speed 12.00, pace —',
    )
  })
})

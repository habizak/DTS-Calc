import { convertUnits } from './convert'
import {
  normalizeDistance,
  normalizePace,
  normalizeTime,
  normalizeVelocity,
  parseDigitsToPace,
  parseDigitsToTime,
} from './normalize'

/**
 * The calculator without a screen. Ported from the PaceCalculator class in js/calculator.js:
 * every rule, rounding step and cap is the same. The class read and wrote DOM inputs; here the
 * same steps run on plain values, and `reduce` replays what each user action used to do.
 */

export type Field = 'time' | 'distance' | 'speed' | 'pace'
export type Target = 'TIME' | 'DISTANCE' | 'SPEED'
export type UnitSystem = 'METRIC' | 'IMPERIAL'
export type LastEdited = 'PACE' | 'SPEED'

export interface Values {
  time: string
  distance: string
  speed: string
  pace: string
}

export interface CalculatorState {
  /** Normally a Target. Kept as a string because saved data is not validated, as before. */
  target: string
  /** Normally a UnitSystem. Kept as a string for the same reason. */
  unitSystem: string
  values: Values
  /** Which of speed or pace the user touched last. Not saved. */
  lastEdited: LastEdited
}

/** The localStorage key. Existing users keep their saved values, so this never changes. */
export const STORAGE_KEY = 'pace-calculator-state'

export const EMPTY_VALUES: Values = { time: '', distance: '', speed: '', pace: '' }

// ---------------------------------------------------------------- parse and format

export function parseTime(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(':').map((p) => parseInt(p) || 0)
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number]
    return h * 3600 + m * 60 + s
  }
  return 0
}

export function parsePace(paceStr: string): number {
  if (!paceStr) return 0
  const parts = paceStr.split(':').map((p) => parseInt(p) || 0)
  if (parts.length === 2) {
    const [m, s] = parts as [number, number]
    return m * 60 + s
  }
  return 0
}

export function formatTime(seconds: number): string {
  let h = Math.floor(seconds / 3600)
  let m = Math.floor((seconds % 3600) / 60)
  let s = Math.round(seconds % 60)
  if (s === 60) {
    s = 0
    m += 1
  }
  if (m === 60) {
    m = 0
    h += 1
  }
  h = Math.min(99, h)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function formatPace(seconds: number): string {
  let m = Math.floor(seconds / 60)
  let s = Math.round(seconds % 60)
  if (s === 60) {
    s = 0
    m += 1
  }
  if (m > 20 || (m === 20 && s > 59)) {
    m = 20
    s = 59
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------- compute

/** The old `compute()`: fill the target field from the others, then keep speed and pace in sync. */
export function computeValues(input: Values, target: string, lastEdited: LastEdited): Values {
  const v: Values = { ...input }

  const time = parseTime(v.time)
  const distance = parseFloat(v.distance) || 0
  const speed = parseFloat(v.speed) || 0
  const pace = parsePace(v.pace)

  const hasV = speed > 0
  const hasP = pace > 0
  const pickPace = (hasP && !hasV) || (hasP && hasV && lastEdited === 'PACE')
  const pickSpeed = (hasV && !hasP) || (hasP && hasV && lastEdited === 'SPEED')

  if (target === 'TIME') {
    if (distance > 0) {
      if (pickSpeed) {
        v.time = formatTime((distance / speed) * 3600)
      } else if (pickPace) {
        v.time = formatTime(distance * pace)
      }
    }
  } else if (target === 'DISTANCE') {
    if (time > 0) {
      if (pickSpeed) {
        v.distance = Math.min(99.99, speed * (time / 3600)).toFixed(2)
      } else if (pickPace) {
        v.distance = Math.min(99.99, time / pace).toFixed(2)
      }
    }
  } else if (target === 'SPEED') {
    if (time > 0 && distance > 0) {
      const vNew = distance / (time / 3600)
      const pNew = time / distance
      v.speed = Math.min(99.99, vNew).toFixed(2)
      v.pace = formatPace(pNew)
    }
  }

  // Keep speed and pace in sync when time and distance are known.
  const tNow = parseTime(v.time)
  const dNow = parseFloat(v.distance) || 0

  if (tNow > 0 && dNow > 0) {
    const vNew = dNow / (tNow / 3600) // units per hour
    const pNew = tNow / dNow // seconds per unit

    const hasSpeed = !!(parseFloat(v.speed) || 0)
    const hasPace = !!parsePace(v.pace)

    if (lastEdited === 'PACE') {
      v.speed = Math.min(99.99, vNew).toFixed(2)
    } else if (lastEdited === 'SPEED') {
      v.pace = formatPace(pNew)
    } else {
      if (!hasSpeed) v.speed = Math.min(99.99, vNew).toFixed(2)
      if (!hasPace) v.pace = formatPace(pNew)
    }
  }

  return v
}

/** Text for the screen-reader live region. The screen only writes it when it changes. */
export function announcement(values: Values): string {
  return `Updated: time ${values.time || '—'}, distance ${values.distance || '—'}, speed ${values.speed || '—'}, pace ${values.pace || '—'}`
}

// ---------------------------------------------------------------- save and load

/** The exact JSON shape existing users already have in localStorage. */
export function serializeState(state: CalculatorState): string {
  return JSON.stringify({
    target: state.target,
    unitSystem: state.unitSystem,
    values: {
      time: state.values.time,
      distance: state.values.distance,
      speed: state.values.speed,
      pace: state.values.pace,
    },
  })
}

export function initialState(): CalculatorState {
  return { target: 'TIME', unitSystem: 'METRIC', values: { ...EMPTY_VALUES }, lastEdited: 'PACE' }
}

/** The old `loadState()`: anything unreadable falls back to the defaults. */
export function loadState(saved: string | null): CalculatorState {
  const state = initialState()
  try {
    if (saved) {
      const parsed = JSON.parse(saved) as {
        target?: unknown
        unitSystem?: unknown
        values?: Partial<Record<Field, unknown>>
      }
      state.target = (parsed.target as string) || 'TIME'
      state.unitSystem = (parsed.unitSystem as string) || 'METRIC'
      if (parsed.values) {
        const saved = parsed.values
        if (saved.time) state.values.time = String(saved.time)
        if (saved.distance) state.values.distance = String(saved.distance)
        if (saved.speed) state.values.speed = String(saved.speed)
        if (saved.pace) state.values.pace = String(saved.pace)
      }
    }
  } catch {
    // Use defaults
  }
  return state
}

// ---------------------------------------------------------------- actions

export type CalculatorAction =
  | { type: 'edit'; field: Field; value: string }
  | { type: 'compute' }
  | { type: 'blur'; field: Field }
  | { type: 'setTarget'; target: Target }
  | { type: 'setUnit'; unit: UnitSystem }
  | { type: 'clear' }
  | { type: 'factoryReset' }

/** Typing only schedules a compute; every other action wrote the state to storage. */
export function actionSaves(action: CalculatorAction): boolean {
  return action.type !== 'edit'
}

function normalizeField(field: Field, raw: string): string {
  const value = raw.trim()
  if (!value) return raw
  if (field === 'time') return normalizeTime(value)
  if (field === 'distance') return normalizeDistance(value)
  if (field === 'speed') return normalizeVelocity(value)
  return normalizePace(value)
}

export function reduce(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'edit': {
      const lastEdited: LastEdited =
        action.field === 'pace' ? 'PACE' : action.field === 'speed' ? 'SPEED' : state.lastEdited
      return { ...state, lastEdited, values: { ...state.values, [action.field]: action.value } }
    }
    case 'compute':
      return { ...state, values: computeValues(state.values, state.target, state.lastEdited) }
    case 'blur': {
      // Digits become a time or pace on blur only, then the value is normalized and computed.
      const values = { ...state.values }
      const raw = values[action.field].trim()
      if (action.field === 'time') {
        const auto = parseDigitsToTime(raw)
        if (auto) values.time = auto
      } else if (action.field === 'pace') {
        const auto = parseDigitsToPace(raw)
        if (auto) values.pace = auto
      }
      values[action.field] = normalizeField(action.field, values[action.field])
      return { ...state, values: computeValues(values, state.target, state.lastEdited) }
    }
    case 'setTarget':
      return { ...state, target: action.target }
    case 'setUnit': {
      // Converts even when the unit is unchanged, which also re-rounds the fields, as before.
      const fields = {
        distanceInput: { value: state.values.distance },
        speedInput: { value: state.values.speed },
        paceInput: { value: state.values.pace },
        normalizePace,
      }
      convertUnits(state.unitSystem, action.unit, fields)
      const values: Values = {
        ...state.values,
        distance: fields.distanceInput.value,
        speed: fields.speedInput.value,
        pace: fields.paceInput.value,
      }
      const next = { ...state, unitSystem: action.unit, values }
      return { ...next, values: computeValues(values, next.target, next.lastEdited) }
    }
    case 'clear':
      return { ...state, values: { ...EMPTY_VALUES } }
    case 'factoryReset':
      return { ...state, values: { ...EMPTY_VALUES }, target: 'TIME', unitSystem: 'METRIC' }
  }
}

// ---------------------------------------------------------------- what the screen shows

export interface FieldView {
  isTarget: boolean
  disabled: boolean
}

export interface CalculatorView {
  fields: Record<Field, FieldView>
  distanceLabel: string
  speedLabel: string
  paceLabel: string
  metricActive: boolean
  imperialActive: boolean
  /** Which circle is pressed. Undefined for an unknown saved target. */
  activeTarget: Target | undefined
}

/** The old `updateUI()` as data: which fields are locked as the target, and the labels. */
export function deriveView(state: Pick<CalculatorState, 'target' | 'unitSystem'>): CalculatorView {
  const isTarget: Record<Field, boolean> = {
    time: state.target === 'TIME',
    distance: state.target === 'DISTANCE',
    // Speed and pace are both derived from time and distance, so both lock.
    speed: state.target === 'SPEED',
    pace: state.target === 'SPEED',
  }
  const metric = state.unitSystem === 'METRIC'
  const known = state.target === 'TIME' || state.target === 'DISTANCE' || state.target === 'SPEED'
  return {
    fields: {
      time: { isTarget: isTarget.time, disabled: isTarget.time },
      distance: { isTarget: isTarget.distance, disabled: isTarget.distance },
      speed: { isTarget: isTarget.speed, disabled: isTarget.speed },
      pace: { isTarget: isTarget.pace, disabled: isTarget.pace },
    },
    distanceLabel: metric ? 'KM' : 'MI',
    speedLabel: metric ? 'KM/H' : 'MPH',
    paceLabel: metric ? 'MIN/KM' : 'MIN/MI',
    metricActive: metric,
    imperialActive: state.unitSystem === 'IMPERIAL',
    activeTarget: known ? (state.target as Target) : undefined,
  }
}

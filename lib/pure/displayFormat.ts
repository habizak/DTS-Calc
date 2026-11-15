/** How a stored value is shown on screen. Display only: stored values, rounding and saved state never change. */

import type { Field } from './calculator'

const ONE_DIGIT_DECIMAL = /^(\d\.\d{2})$/
const LEADING_ZEROS = /^0+(?=\d)/

/** Distance and speed show two digits before the point (5.00 -> 05.00), like Time shows 00:00:00. */
export function displayValue(field: Field, value: string): string {
  if (field === 'distance' || field === 'speed') {
    return ONE_DIGIT_DECIMAL.test(value) ? `0${value}` : value
  }
  return value
}

/** Undo the display padding on typed input, so the leading zero never reaches the state. */
export function stripDisplayPadding(field: Field, typed: string): string {
  if (field === 'distance' || field === 'speed') return typed.replace(LEADING_ZEROS, '')
  return typed
}

/** The three unit-dependent fields. Anything with a string `value` works (an input element or a plain object). */
export interface ConvertFields {
  distanceInput: { value: string }
  speedInput: { value: string }
  paceInput: { value: string }
  normalizePace: (pace: string) => string
}

/**
 * Metric <-> Imperial conversion of the distance, speed and pace fields, in place.
 * Ported unchanged from js/convert.js: same factor, same rounding, same caps.
 */
export function convertUnits(
  fromSystem: string,
  toSystem: string,
  { distanceInput, speedInput, paceInput, normalizePace }: ConvertFields,
): void {
  const CF = 1.609344

  if (distanceInput.value) {
    let d = parseFloat(distanceInput.value) || 0
    if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') d /= CF
    else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') d *= CF
    distanceInput.value = Math.min(99.99, d).toFixed(2)
  }

  if (speedInput.value) {
    let v = parseFloat(speedInput.value) || 0
    if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') v /= CF
    else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') v *= CF
    speedInput.value = Math.min(99.99, v).toFixed(2)
  }

  if (paceInput.value) {
    // A value without a colon leaves `ss` undefined and the total NaN, exactly as before.
    const [mm, ss] = paceInput.value.split(':').map((n) => parseInt(n) || 0) as [number, number]
    let total = mm * 60 + ss
    if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') total *= CF
    else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') total /= CF
    paceInput.value = normalizePace(`${Math.floor(total / 60)}:${Math.round(total % 60)}`)
  }
}

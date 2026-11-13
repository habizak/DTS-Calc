/** Demo logic: the one thing the demo screen does. Replace with the app's own logic. */
export const COUNTER_KEY = 'starter_count'

export function parseCount(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import PaceCalculator from '../components/PaceCalculator'

/** The inner markup of a Monoform icon file, so the app never holds its own copy of the drawing. */
function iconMarkup(name: string): string {
  const svg = readFileSync(join(process.cwd(), '.monoform', 'icons', 'svg', `${name}.svg`), 'utf8')
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  if (!match) throw new Error(`Monoform icon ${name} is not an svg`)
  return match[1] as string
}

export default function Page() {
  return <PaceCalculator resetIcon={iconMarkup('reset')} />
}

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../lib/pure/calculator'
import PaceCalculator from './PaceCalculator'

beforeEach(() => localStorage.clear())

async function mount() {
  const view = render(<PaceCalculator />)
  await act(async () => {})
  return view
}

describe('the shared controls on the calculator screen', () => {
  it('units: a native radio group, Metric first and selected, Imperial switches the labels and is saved', async () => {
    await mount()
    const units = screen.getByRole('radiogroup', { name: 'Units' })
    expect(within(units).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['METRIC', 'IMPERIAL'])
    expect(screen.getByRole('radio', { name: 'Metric' })).toBeChecked()
    expect(document.getElementById('distanceLabel')).toHaveTextContent('KM')
    fireEvent.click(screen.getByRole('radio', { name: 'Imperial' }))
    expect(screen.getByRole('radio', { name: 'Imperial' })).toBeChecked()
    expect(document.getElementById('distanceLabel')).toHaveTextContent('MI')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').unitSystem).toBe('IMPERIAL')
  })

  it('targets: Time, Distance and Speed are one radio group; choosing one disables that field', async () => {
    await mount()
    const targets = screen.getByRole('radiogroup', { name: 'Solve for' })
    expect(within(targets).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['TIME', 'DISTANCE', 'SPEED'])
    fireEvent.click(screen.getByRole('radio', { name: 'Time' }))
    expect(screen.getByRole('radio', { name: 'Time' })).toBeChecked()
    expect(document.getElementById('timeInput')).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Speed' }))
    expect(screen.getByRole('radio', { name: 'Speed' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Time' })).not.toBeChecked()
    expect(document.getElementById('speedInput')).toBeDisabled()
    expect(document.getElementById('timeInput')).not.toBeDisabled()
  })

  it('reset: a ghost button with its icon hidden; a click clears the values and the long press stays wired', async () => {
    await mount()
    fireEvent.change(document.getElementById('distanceInput')!, { target: { value: '10' } })
    fireEvent.blur(document.getElementById('distanceInput')!)
    expect(document.getElementById('distanceInput')).toHaveValue('10.00')
    const reset = screen.getByRole('button', { name: 'Reset' })
    expect(reset).toHaveClass('mf-button', 'mf-button--ghost')
    expect(reset.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.mouseDown(reset)
    fireEvent.mouseUp(reset)
    expect(document.getElementById('distanceInput')).toHaveValue('')
  })
})

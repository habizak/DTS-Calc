import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Demo from './Demo'

describe('Demo', () => {
  beforeEach(() => localStorage.clear())

  it('counts clicks and keeps the count in localStorage', () => {
    render(<Demo />)
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    expect(localStorage.getItem('starter_count')).toBe('2')
  })

  it('restores the saved count', async () => {
    localStorage.setItem('starter_count', '5')
    render(<Demo />)
    expect(await screen.findByText('5')).toBeInTheDocument()
  })
})

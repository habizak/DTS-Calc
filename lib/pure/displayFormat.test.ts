import { describe, expect, it } from 'vitest'
import { displayValue, stripDisplayPadding } from './displayFormat'

describe('displayValue', () => {
  it('pads one-digit distance and speed to two digits', () => {
    expect(displayValue('distance', '5.00')).toBe('05.00')
    expect(displayValue('speed', '9.50')).toBe('09.50')
    expect(displayValue('distance', '0.00')).toBe('00.00')
  })

  it('leaves two-digit, empty and half-typed values alone', () => {
    expect(displayValue('distance', '11.01')).toBe('11.01')
    expect(displayValue('distance', '')).toBe('')
    expect(displayValue('distance', '5')).toBe('5')
    expect(displayValue('distance', '5.2')).toBe('5.2')
    expect(displayValue('speed', '0')).toBe('0')
  })

  it('does not touch time or pace', () => {
    expect(displayValue('time', '01:13:20')).toBe('01:13:20')
    expect(displayValue('pace', '06:40')).toBe('06:40')
  })
})

describe('stripDisplayPadding', () => {
  it('removes the leading zero the display added', () => {
    expect(stripDisplayPadding('distance', '05.00')).toBe('5.00')
    expect(stripDisplayPadding('speed', '05.253')).toBe('5.253')
  })

  it('keeps a lone zero and a zero before the point', () => {
    expect(stripDisplayPadding('distance', '0')).toBe('0')
    expect(stripDisplayPadding('distance', '0.5')).toBe('0.5')
    expect(stripDisplayPadding('distance', '')).toBe('')
  })

  it('does not touch time or pace', () => {
    expect(stripDisplayPadding('time', '00:00:05')).toBe('00:00:05')
    expect(stripDisplayPadding('pace', '06:40')).toBe('06:40')
  })
})

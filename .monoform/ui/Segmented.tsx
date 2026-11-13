import { type ReactNode, useId } from 'react'
import './Segmented.css'
import type { ButtonSize } from './Button'

export interface SegmentedOption<T extends string = string> {
  /** What onChange reports. Unique in the group. */
  value: T
  /** Text only. An icon-only segment would be a circle, which cannot sit inside a rectangle group. */
  label: ReactNode
  disabled?: boolean
}

type TwoToFive<T> = readonly [T, T] | readonly [T, T, T] | readonly [T, T, T, T] | readonly [T, T, T, T, T]

/** The group needs a name: a visible label (aria-labelledby) or aria-label. */
type Named = { 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never }

export type SegmentedProps<T extends string = string> = Named & {
  /** Two to five options. More than five is a select or a list, not this component. */
  options: TwoToFive<SegmentedOption<T>>
  /** The selected value. null means none selected, which is valid (a preset whose value was typed instead). */
  value: NoInfer<T> | null
  onChange: (value: T) => void
  /** Same control heights as Button: xs 1.5rem, s 2rem, m 2.5rem (default), l 3rem. */
  size?: ButtonSize
  disabled?: boolean
  /** Shared by the radios. Defaults to a generated id. */
  name?: string
  /** For layout only. */
  className?: string
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

/** Pick exactly one option, all visible, effect immediate. Not for on/off, not for navigation, not for screens (that is tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'm',
  disabled = false,
  name,
  className,
  ...labelling
}: SegmentedProps<T>) {
  const generated = useId()
  const group = name ?? generated
  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx('mf-segmented', `mf-segmented--${size}`, disabled && 'mf-segmented--disabled', className)}
      {...labelling}
    >
      {options.map((option) => (
        <label key={option.value} className="mf-segmented__segment">
          <input
            type="radio"
            className="mf-segmented__input"
            name={group}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
          />
          <span className="mf-segmented__text">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

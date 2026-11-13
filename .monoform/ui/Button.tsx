import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'
import './Button.css'

/** Style: primary is the one main action in a view; secondary has a 1px border; ghost has none. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
/** Size is the control height: xs 1.5rem, s 2rem, m 2.5rem (default), l 3rem. The touch area is always at least 2.75rem. */
export type ButtonSize = 'xs' | 's' | 'm' | 'l'

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'style'>

export interface ButtonProps extends NativeProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** A Monoform icon (an svg element) shown before the label. The label stays the main thing, so the button stays a rectangle. */
  icon?: ReactNode
  /** The label. Verb first: "Create Note", not "Note Creation". */
  children: ReactNode
}

export interface IconButtonProps extends NativeProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** The icon, an svg element from the Monoform set. Icon-only buttons are for universal icons (close, check, plus, minus, back, delete, copy). */
  icon: ReactNode
  /** Required: an icon alone has no name. */
  'aria-label': string
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

/** A text button. Shape follows content: a label means a rectangle (radius 0), with or without an icon. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'm', icon, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx('mf-button', `mf-button--${variant}`, `mf-button--${size}`, className)} {...rest}>
      {icon ? (
        <span className="mf-button__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  )
})

/** An icon-only button. Shape follows content: only an icon inside means a circle (radius 9999), 1:1 at the control height. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'secondary', size = 'm', icon, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx('mf-button', `mf-button--${variant}`, `mf-button--${size}`, 'mf-button--icon', className)} {...rest}>
      <span className="mf-button__icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  )
})

import { ICON_PATHS, type IconName } from './icons'

/** Pixels per icon edge: 1, 2 or 3 pixels per cell on the 11 pixel grid. Never fractional. */
export type IconSize = 11 | 22 | 33

export interface IconProps {
  /** A name from the Monoform set (see .monoform/icons.json for what each one means). One function, one icon. */
  name: IconName
  /** Default 22 (two pixels per cell). */
  size?: IconSize
  /** For layout only. */
  className?: string
}

/**
 * A Monoform pixel icon, drawn as one path. It takes the text colour of its context (currentColor) and is
 * hidden from assistive technology: an icon never stands alone, so the button or label around it carries the name.
 */
export function Icon({ name, size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 11 11"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

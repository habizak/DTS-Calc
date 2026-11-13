import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './Stepped.css'

/** Where the layer grows from. The command bar is bottom. Stepped Out shrinks back to the same point. */
export type SteppedDirection = 'center' | 'top' | 'bottom' | 'left' | 'right'
/** Speed follows the size of the thing: l (220ms) for surfaces across the full width or height of the screen, s (130ms) for everything else. */
export type SteppedSpeed = 's' | 'l'
/** How it leaves. out: permanent or large things (command bar, Focus mode, side panels). pop: small or transient things (modal, note, toast, cell). */
export type SteppedExit = 'out' | 'pop'

export interface SteppedProps {
  /** true: Stepped In. false: Stepped Out or Terminal Pop, then nothing is left on screen. */
  open: boolean
  speed?: SteppedSpeed
  direction?: SteppedDirection
  exit?: SteppedExit
  /** Called once the exit has finished and the panel is hidden. */
  onClosed?: () => void
  /** The content: text, and SteppedAction wrappers around the actions. It always sits at its final size. */
  children: ReactNode
  /** For layout only (width, height, margin). */
  className?: string
}

type State = 'closed' | 'in' | 'open' | 'out' | 'pop'

const SPEED_MS: Record<SteppedSpeed, number> = { s: 130, l: 220 }
const IN_SEQUENCE_MS = 320 // the last action finishes popping in at 280 + 40ms
const POP_MS = 105
// Terminal Pop swells by min(0.18, 0.5rem / longest side), so a cell grows to 1.18 and a 15rem modal about 0.5rem in all.
const popGrowth = (el: HTMLElement) => {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const longest = Math.max(el.offsetWidth, el.offsetHeight)
  return longest > 0 ? Math.min(0.18, (0.5 * rem) / longest) : 0.18
}
const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

/**
 * A panel that appears with Stepped In and leaves with Stepped Out or Terminal Pop. Plays when `open` changes, not on first paint.
 * A press or keystroke while it is appearing finishes the entrance at once. With reduced motion it goes straight to the resting state.
 */
export function Stepped({ open, speed = 's', direction = 'center', exit = 'out', onClosed, children, className }: SteppedProps) {
  const [state, setState] = useState<State>(open ? 'open' : 'closed')
  const root = useRef<HTMLDivElement>(null)
  const previous = useRef(open)
  const closed = useRef(onClosed)
  closed.current = onClosed

  // Terminal Pop needs the size of the panel before it plays.
  useLayoutEffect(() => {
    if (state === 'pop' && root.current) root.current.style.setProperty('--mf-stepped-pe', String(popGrowth(root.current)))
  }, [state])

  useEffect(() => {
    if (previous.current === open) return // first paint, or a re-run of the effect with nothing changed
    previous.current = open
    if (reduced()) {
      setState(open ? 'open' : 'closed')
      if (!open) closed.current?.()
      return
    }
    if (open) {
      setState('in')
      const timer = setTimeout(() => setState('open'), Math.max(SPEED_MS[speed], IN_SEQUENCE_MS))
      return () => clearTimeout(timer)
    }
    setState(exit === 'pop' ? 'pop' : 'out')
    const timer = setTimeout(
      () => {
        setState('closed')
        closed.current?.()
      },
      exit === 'pop' ? POP_MS : SPEED_MS[speed],
    )
    return () => clearTimeout(timer)
  }, [open, speed, exit])

  const finishEntrance = useCallback(() => setState((s) => (s === 'in' ? 'open' : s)), [])

  return (
    <div
      ref={root}
      data-state={state}
      className={cx('mf-stepped', `mf-stepped--${speed}`, `mf-stepped--${direction}`, className)}
      onPointerDownCapture={finishEntrance}
      onKeyDownCapture={finishEntrance}
    >
      <div className="mf-stepped__bg" aria-hidden="true" />
      <div className="mf-stepped__content">{children}</div>
    </div>
  )
}

/** An action inside a Stepped panel. It pops in after the text: the first at 220ms, the second at 280ms. */
export function SteppedAction({ order = 1, children }: { order?: 1 | 2; children: ReactNode }) {
  return <span className={`mf-stepped__action mf-stepped__action--${order}`}>{children}</span>
}

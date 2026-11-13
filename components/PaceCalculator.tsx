'use client'

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useViewportLock } from '../hooks/useViewportLock'
import {
  type CalculatorAction,
  type CalculatorState,
  type Field,
  STORAGE_KEY,
  actionSaves,
  announcement,
  deriveView,
  initialState,
  loadState,
  reduce,
  serializeState,
} from '../lib/pure/calculator'

const DEBOUNCE_MS = 200
const LONG_PRESS_MS = 500

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeSaved(state: CalculatorState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state))
  } catch {
    // Storage can be blocked. The calculator still works for this visit.
  }
}

/** The one screen. Markup and class names match the old index.html; the rules live in lib/pure. */
export default function PaceCalculator() {
  const [state, setState] = useState<CalculatorState>(initialState)
  const [ann, setAnn] = useState('')
  const stateRef = useRef(state)
  const lastAnn = useRef('')
  const computeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appRef = useRef<HTMLDivElement>(null)

  useViewportLock(appRef)

  /** Apply one user action: update state, save when the old screen saved, update the announcer. */
  const apply = useCallback((action: CalculatorAction) => {
    const next = reduce(stateRef.current, action)
    stateRef.current = next
    setState(next)
    if (actionSaves(action)) writeSaved(next)
    if (action.type === 'compute' || action.type === 'blur' || action.type === 'setUnit') {
      const message = announcement(next.values)
      if (message !== lastAnn.current) {
        lastAnn.current = message
        setAnn(message)
      }
    }
  }, [])

  const clearComputeTimer = useCallback(() => {
    if (computeTimer.current) clearTimeout(computeTimer.current)
    computeTimer.current = null
  }, [])

  // Saved values are read once on load, as before. Nothing is computed or written at that point.
  useEffect(() => {
    const loaded = loadState(readSaved())
    stateRef.current = loaded
    setState(loaded)
    return () => {
      clearComputeTimer()
      if (pressTimer.current) clearTimeout(pressTimer.current)
    }
  }, [clearComputeTimer])

  const onEdit = (field: Field) => (event: ChangeEvent<HTMLInputElement>) => {
    apply({ type: 'edit', field, value: event.target.value })
    clearComputeTimer()
    computeTimer.current = setTimeout(() => apply({ type: 'compute' }), DEBOUNCE_MS)
  }

  const onBlur = (field: Field) => () => {
    clearComputeTimer()
    apply({ type: 'blur', field })
  }

  // Click clears the values; a long press (500 ms) does a factory reset. Same rules as before,
  // including that a release after the long press also clears (harmless: the values are empty).
  const startPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => apply({ type: 'factoryReset' }), LONG_PRESS_MS)
  }
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }
  const releasePress = () => {
    if (pressTimer.current) {
      cancelPress()
      apply({ type: 'clear' })
    }
  }

  const view = deriveView(state)
  const fieldClass = (field: Field, name: string) =>
    `ctds-field ctds-field--${name} ${view.fields[field].isTarget ? 'is-target' : 'is-nontarget'}`
  const circle = (target: 'TIME' | 'DISTANCE' | 'SPEED', id: string, label: string) => {
    const active = view.activeTarget === target
    return (
      <button
        className={`ctds-circle${active ? ' is-active' : ''}`}
        id={id}
        aria-pressed={active}
        type="button"
        onClick={() => apply({ type: 'setTarget', target })}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="ctds-app" ref={appRef}>
      <header className="ctds-header">
        <span className="ctds-header-title">
          <span className="ctds-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 8 8" width="24" height="24" fill="currentColor" shapeRendering="crispEdges">
              <rect x="1" y="1" width="1" height="1" />
              <rect x="0" y="2" width="1" height="1" />
              <rect x="3" y="2" width="4" height="1" />
              <rect x="1" y="3" width="1" height="1" />
              <rect x="6" y="4" width="1" height="1" />
              <rect x="1" y="5" width="4" height="1" />
              <rect x="7" y="5" width="1" height="1" />
              <rect x="6" y="6" width="1" height="1" />
            </svg>
          </span>
          <span className="ctds-header-label">DTS-Calc</span>
        </span>
      </header>

      <div className="ctds-scroll">
        <div className="ctds-single-shell" id="singlePaceApp">
          <main className="ctds-main">
            <div className={fieldClass('time', 'time')}>
              <label className="ctds-label" htmlFor="timeInput" id="timeLabel">
                HH:MM:SS
              </label>
              <input
                type="text"
                className="ctds-value"
                id="timeInput"
                placeholder="00:00:00"
                aria-describedby="timeLabel"
                inputMode="numeric"
                pattern="\d{1,2}:\d{2}:\d{2}"
                value={state.values.time}
                disabled={view.fields.time.disabled}
                aria-disabled={view.fields.time.disabled}
                onChange={onEdit('time')}
                onBlur={onBlur('time')}
              />
            </div>

            <div className={fieldClass('distance', 'distance')}>
              <label className="ctds-label" htmlFor="distanceInput" id="distanceLabel">
                {view.distanceLabel}
              </label>
              <input
                type="text"
                className="ctds-value"
                id="distanceInput"
                placeholder="00.00"
                aria-describedby="distanceLabel"
                inputMode="decimal"
                value={state.values.distance}
                disabled={view.fields.distance.disabled}
                aria-disabled={view.fields.distance.disabled}
                onChange={onEdit('distance')}
                onBlur={onBlur('distance')}
              />
            </div>

            <div className={fieldClass('speed', 'speed')}>
              <label className="ctds-label" htmlFor="speedInput" id="speedLabel">
                {view.speedLabel}
              </label>
              <input
                type="text"
                className="ctds-value"
                id="speedInput"
                placeholder="00.00"
                aria-describedby="speedLabel"
                inputMode="decimal"
                value={state.values.speed}
                disabled={view.fields.speed.disabled}
                aria-disabled={view.fields.speed.disabled}
                onChange={onEdit('speed')}
                onBlur={onBlur('speed')}
              />
            </div>

            <div className={fieldClass('pace', 'pace')}>
              <label className="ctds-label" htmlFor="paceInput" id="paceLabel">
                {view.paceLabel}
              </label>
              <input
                type="text"
                className="ctds-value"
                id="paceInput"
                placeholder="00:00"
                aria-describedby="paceLabel"
                inputMode="numeric"
                pattern="\d{1,2}:\d{2}"
                value={state.values.pace}
                disabled={view.fields.pace.disabled}
                aria-disabled={view.fields.pace.disabled}
                onChange={onEdit('pace')}
                onBlur={onBlur('pace')}
              />
            </div>
          </main>

          <footer className="ctds-controls">
            <div className="ctds-toggle-row">
              <button
                className={`ctds-toggle${view.metricActive ? ' is-active' : ''}`}
                id="unitToggle"
                type="button"
                onClick={() => apply({ type: 'setUnit', unit: 'METRIC' })}
              >
                Metric
              </button>
              <button
                className={`ctds-toggle${view.imperialActive ? ' is-active' : ''}`}
                id="imperialToggle"
                type="button"
                onClick={() => apply({ type: 'setUnit', unit: 'IMPERIAL' })}
              >
                Imperial
              </button>
            </div>

            <div className="ctds-circles">
              {circle('TIME', 'timeBtn', 'Time')}
              {circle('DISTANCE', 'distanceBtn', 'Distance')}
              {circle('SPEED', 'speedBtn', 'Speed')}
            </div>

            <div className="ctds-reset">
              <button
                className="ctds-reset-btn"
                id="resetBtn"
                type="button"
                onMouseDown={startPress}
                onTouchStart={startPress}
                onMouseUp={releasePress}
                onTouchEnd={releasePress}
                onMouseLeave={cancelPress}
              >
                <span className="ctds-reset-icon" aria-hidden="true">
                  ↺
                </span>
                <span className="ctds-reset-text">Reset</span>
              </button>
            </div>
          </footer>
        </div>
      </div>

      <div id="ann" role="status" aria-live="polite" className="ctds-announcer">
        {ann}
      </div>
    </div>
  )
}

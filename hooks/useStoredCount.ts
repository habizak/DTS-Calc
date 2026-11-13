'use client'

import { useCallback, useEffect, useState } from 'react'
import { COUNTER_KEY, parseCount } from '../lib/pure/counter'

/** Count kept in localStorage so the demo works offline and survives a reload. */
export function useStoredCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(parseCount(localStorage.getItem(COUNTER_KEY)))
  }, [])

  const bump = useCallback(() => {
    setCount((c) => {
      const next = c + 1
      localStorage.setItem(COUNTER_KEY, String(next))
      return next
    })
  }, [])

  return { count, bump }
}

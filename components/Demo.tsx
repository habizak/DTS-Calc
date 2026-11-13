'use client'

import { useStoredCount } from '../hooks/useStoredCount'

/** One demo screen. It exists so the gates have something real to test. */
export default function Demo() {
  const { count, bump } = useStoredCount()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-xl font-medium">Starter</h1>
      <p className="text-muted">Count: <span data-testid="count">{count}</span></p>
      <button
        type="button"
        onClick={bump}
        className="h-[var(--control-m)] border border-fg bg-accent px-4 font-medium text-on-accent"
      >
        Add one
      </button>
    </main>
  )
}

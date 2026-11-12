/**
 * Runs an action after a delay unless it is cancelled first. Used for "undo": the UI removes an
 * item at once, and the real server delete is scheduled a few seconds out. Pressing Undo cancels
 * it before it runs, so nothing was ever lost.
 *
 * Keyed by a string so each item has at most one pending action; scheduling again replaces it.
 * A failed action never throws into the timer.
 */
export interface DeferredActions {
  /** Schedule `run` after `delayMs`. Replaces any pending action for `key`. */
  schedule: (key: string, run: () => void | Promise<void>, delayMs: number) => void
  /** Cancel a pending action. Returns true if one was pending (so the caller can undo its UI change). */
  cancel: (key: string) => boolean
  /** Whether an action is pending for `key`. */
  has: (key: string) => boolean
  /** Number of pending actions. */
  pending: () => number
  /** Run every pending action now (e.g. the screen is unmounting) and clear the schedule. */
  flushAll: () => void
  /** Cancel every pending action without running it. */
  cancelAll: () => void
}

export function createDeferredActions(): DeferredActions {
  const entries = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void | Promise<void> }>()

  const fire = (key: string) => {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    try {
      void Promise.resolve(entry.run()).catch(() => undefined)
    } catch {
      /* an action must never break the scheduler */
    }
  }

  const clear = (key: string) => {
    const entry = entries.get(key)
    if (entry) clearTimeout(entry.timer)
    return entries.delete(key)
  }

  return {
    schedule: (key, run, delayMs) => {
      clear(key)
      const timer = setTimeout(() => fire(key), delayMs)
      entries.set(key, { timer, run })
    },
    cancel: (key) => clear(key),
    has: (key) => entries.has(key),
    pending: () => entries.size,
    flushAll: () => {
      for (const key of [...entries.keys()]) {
        const entry = entries.get(key)
        if (entry) clearTimeout(entry.timer)
        fire(key)
      }
    },
    cancelAll: () => {
      for (const entry of entries.values()) clearTimeout(entry.timer)
      entries.clear()
    },
  }
}

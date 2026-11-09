/**
 * Runs async tasks one at a time per key, in the order they were added. Different keys run
 * in parallel. Used for item mutations: the UI changes at once (optimistically) and the
 * writes for one item reach the server in tap order, so a quick tick / un-tick never races.
 *
 * A failed task does not stop the tasks queued behind it; each caller gets its own result.
 */
export interface KeyedQueue {
  enqueue<T>(key: string, task: () => Promise<T>): Promise<T>
  /** Tasks for this key that have not settled yet (running + waiting). */
  pending(key: string): number
  /** Unsettled tasks across all keys. */
  totalPending(): number
}

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<void>>()
  const counts = new Map<string, number>()
  let total = 0

  return {
    enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      total += 1
      const previous = tails.get(key) ?? Promise.resolve()
      const run = previous.then(task)
      // The tail never rejects, and the count drops BEFORE the caller's promise settles, so a
      // caller can ask "was that the last one?" inside its own then/catch.
      const tail = run.then(
        () => undefined,
        () => undefined,
      ).then(() => {
        const left = (counts.get(key) ?? 1) - 1
        if (left <= 0) {
          counts.delete(key)
          if (tails.get(key) === tail) tails.delete(key)
        } else {
          counts.set(key, left)
        }
        total -= 1
      })
      tails.set(key, tail)
      return tail.then(() => run)
    },
    pending: (key) => counts.get(key) ?? 0,
    totalPending: () => total,
  }
}

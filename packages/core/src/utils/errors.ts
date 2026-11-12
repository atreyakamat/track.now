/**
 * Turns an unknown thrown value into a short, human sentence for a toast or inline
 * error. Prefers a real Error message; otherwise falls back to the caller's phrasing.
 * Network failures get a kinder, consistent line so every mutation reads the same way.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (isLikelyNetworkError(err)) return 'You appear to be offline. Please try again when you are back.'
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err
  return fallback
}

/** True when the thrown value looks like a dropped connection rather than a real server reply. */
export function isLikelyNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return /failed to fetch|network\s*error|networkerror|load failed|fetch failed|timed? out|connection/i.test(msg)
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { getStorage } from '@tracknow/core/platform/storage'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-runs the loader. */
  reload: () => void
  /** True while a reload (not the first load) is in flight — for pull-to-refresh. */
  refreshing: boolean
  /** True when the data shown came from the on-device cache after a failed load (offline). */
  stale: boolean
}

interface Options {
  /**
   * When set, the last successful result is cached on-device under this key. On mount the
   * cached value renders instantly, and if a load fails the cached value is kept (marked
   * `stale`) instead of showing an error — so the app stays usable offline.
   */
  cacheKey?: string
}

const CACHE_PREFIX = 'tracknow_cache_'

function readCache<T>(key: string): T | null {
  try {
    const raw = getStorage()?.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    getStorage()?.setItem(CACHE_PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable or value too large — caching is best-effort */
  }
}

/**
 * Runs an async loader on mount and whenever `deps` change, tracking loading/error state
 * and exposing a manual reload (used for pull-to-refresh and after mutations). With a
 * `cacheKey` it also persists the last result for instant, offline-tolerant loads.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], options: Options = {}): AsyncState<T> {
  const { cacheKey } = options
  const [data, setData] = useState<T | null>(() => (cacheKey ? readCache<T>(cacheKey) : null))
  // If we already have cached data, don't show a blocking spinner on first load.
  const [loading, setLoading] = useState(() => !(cacheKey && readCache<T>(cacheKey) !== null))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)
  const first = useRef(true)
  const hasData = useRef(cacheKey ? readCache<T>(cacheKey) !== null : false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (first.current && !hasData.current) setLoading(true)
    else setRefreshing(true)
    setError(null)
    loader()
      .then((result) => {
        if (!mounted.current) return
        setData(result)
        setStale(false)
        hasData.current = true
        if (cacheKey) writeCache(cacheKey, result)
      })
      .catch((err) => {
        if (!mounted.current) return
        // Keep cached data on failure (offline); only surface an error with nothing to show.
        if (hasData.current) setStale(true)
        else setError(err instanceof Error ? err.message : 'Something went wrong')
      })
      .finally(() => {
        if (mounted.current) {
          setLoading(false)
          setRefreshing(false)
          first.current = false
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  return { data, loading, error, reload, refreshing, stale }
}

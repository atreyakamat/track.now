import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-runs the loader. */
  reload: () => void
  /** True while a reload (not the first load) is in flight — for pull-to-refresh. */
  refreshing: boolean
}

/**
 * Runs an async loader on mount and whenever `deps` change, tracking loading/error state
 * and exposing a manual reload (used for pull-to-refresh and after mutations).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)
  const first = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (first.current) setLoading(true)
    else setRefreshing(true)
    setError(null)
    loader()
      .then((result) => {
        if (mounted.current) setData(result)
      })
      .catch((err) => {
        if (mounted.current) setError(err instanceof Error ? err.message : 'Something went wrong')
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

  return { data, loading, error, reload, refreshing }
}

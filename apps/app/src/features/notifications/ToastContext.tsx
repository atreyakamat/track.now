import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  id?: string
  title: string
  message?: string
  nextUp?: string
  type?: 'success' | 'info' | 'warning'
  action?: ToastAction
  duration?: number // ms, defaults to 4000
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
  dismissToast: (id: string) => void
  /** Removes every toast (and its timer). Used on sign-out / account switch. */
  clearAll: () => void
}

export type ToastEntry = ToastOptions & { id: string; duration: number }

/** At most this many auto-dismissing toasts are kept; persistent (duration 0) toasts are never evicted. */
export const MAX_TRANSIENT_TOASTS = 5

export function resolveToastDuration(options: ToastOptions): number {
  // Toasts with an action get more time to be read and used.
  return options.duration !== undefined ? options.duration : options.action ? 8000 : 5000
}

/**
 * Adds (or replaces, by id) a toast. Only transient toasts are capped: a persistent toast
 * (duration 0, e.g. a reminder that may be the only delivery channel) is never evicted by a
 * burst of short-lived ones.
 */
export function appendToast(prev: ToastEntry[], toast: ToastEntry, maxTransient = MAX_TRANSIENT_TOASTS): ToastEntry[] {
  const next = [...prev.filter((t) => t.id !== toast.id), toast]
  const transientCount = next.filter((t) => t.duration > 0).length
  let toDrop = Math.max(0, transientCount - maxTransient)
  if (toDrop === 0) return next
  return next.filter((t) => {
    if (toDrop > 0 && t.duration > 0) {
      toDrop -= 1
      return false
    }
    return true
  })
}

export interface ToastStore {
  getSnapshot: () => ToastEntry[]
  subscribe: (listener: () => void) => () => void
  show: (options: ToastOptions) => string
  dismiss: (id: string) => void
  clearAll: () => void
}

/** Framework-free toast state (timers included) so the behaviour is unit-testable. */
export function createToastStore(): ToastStore {
  let toasts: ToastEntry[] = []
  const listeners = new Set<() => void>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const set = (next: ToastEntry[]) => {
    toasts = next
    listeners.forEach((l) => l())
  }
  const clearTimer = (id: string) => {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  }

  const dismiss = (id: string) => {
    clearTimer(id)
    if (toasts.some((t) => t.id === id)) set(toasts.filter((t) => t.id !== id))
  }

  return {
    getSnapshot: () => toasts,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    show: (options) => {
      const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const duration = resolveToastDuration(options)
      // Re-showing a toast with the same id restarts its timer instead of letting the
      // previous timer dismiss the new content early.
      clearTimer(id)
      const next = appendToast(toasts, { ...options, id, duration })
      // Evicted transient toasts must not leave timers behind.
      const kept = new Set(next.map((t) => t.id))
      Array.from(timers.keys()).forEach((key) => {
        if (!kept.has(key)) clearTimer(key)
      })
      set(next)
      if (duration > 0) {
        timers.set(
          id,
          setTimeout(() => {
            timers.delete(id)
            if (toasts.some((t) => t.id === id)) set(toasts.filter((t) => t.id !== id))
          }, duration),
        )
      }
      return id
    },
    dismiss,
    clearAll: () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      if (toasts.length > 0) set([])
    },
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createToastStore)
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  const showToast = useCallback((options: ToastOptions) => void store.show(options), [store])
  const dismissToast = useCallback((id: string) => store.dismiss(id), [store])
  const clearAll = useCallback(() => store.clearAll(), [store])
  const value = useMemo(() => ({ showToast, dismissToast, clearAll }), [showToast, dismissToast, clearAll])

  useEffect(() => () => store.clearAll(), [store])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-container"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height, 64px) + 16px)',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
          width: 'calc(100% - 32px)',
          // Persistent reminder toasts are never evicted, so the stack scrolls instead of
          // running off-screen.
          maxHeight: 'calc(100vh - var(--bottom-nav-height, 64px) - 32px)',
          overflowY: 'auto',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const icon =
            toast.type === 'warning' ? (
              <AlertTriangle size={18} color="var(--warning)" aria-hidden="true" />
            ) : toast.type === 'info' ? (
              <Info size={18} color="var(--text-secondary)" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} color="var(--success)" aria-hidden="true" />
            )

          return (
            <div
              key={toast.id}
              className="toast-card"
              style={{
                pointerEvents: 'auto',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.18))',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'slideUp 0.2s ease-out',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {toast.title}
                </div>
                {toast.message && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {toast.message}
                  </div>
                )}
                {toast.nextUp && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Next up:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{toast.nextUp}</span>
                  </div>
                )}
                {toast.action && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{
                      marginTop: '8px',
                      minHeight: '32px',
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                    }}
                    onClick={() => {
                      toast.action?.onClick()
                      dismissToast(toast.id)
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn--icon btn--ghost btn--sm"
                style={{ width: '32px', height: '32px', minHeight: '32px', padding: 0, flexShrink: 0 }}
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

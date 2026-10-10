import React, { createContext, useContext, useState, useCallback } from 'react'
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
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<ToastOptions & { id: string }>>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const newToast = { ...options, id }

      setToasts((prev) => [...prev.filter((t) => t.id !== id), newToast])

      const duration = options.duration !== undefined ? options.duration : 4000
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }
    },
    [dismissToast],
  )

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
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
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const icon =
            toast.type === 'warning' ? (
              <AlertTriangle size={18} color="var(--warning, #e67e22)" />
            ) : toast.type === 'info' ? (
              <Info size={18} color="var(--accent-primary, #c8f169)" />
            ) : (
              <CheckCircle2 size={18} color="var(--accent-primary, #c8f169)" />
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
                      color: 'var(--accent-primary, #c8f169)',
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
                      minHeight: '28px',
                      padding: '2px 8px',
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
                style={{ width: '28px', height: '28px', minHeight: '28px', padding: 0, flexShrink: 0 }}
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

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing, type ThemeColors } from '@/theme/tokens'

export type ToastType = 'success' | 'info' | 'warning'

export interface ToastOptions {
  id?: string
  title: string
  message?: string
  /** Shown as a subtle "Next up" line. */
  nextUp?: string
  type?: ToastType
  duration?: number
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 4

type ToastEntry = ToastOptions & { id: string }

function borderFor(type: ToastType | undefined, colors: ThemeColors): string {
  if (type === 'success') return colors.success
  if (type === 'warning') return colors.warning
  return colors.borderStrong
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const seq = useRef(0)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current[id]
    if (timer) {
      clearTimeout(timer)
      delete timers.current[id]
    }
  }, [])

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? `toast-${++seq.current}`
      const duration = options.duration ?? (options.type === 'warning' ? 6000 : 3500)
      setToasts((prev) => {
        const without = prev.filter((t) => t.id !== id)
        return [...without, { ...options, id }].slice(-MAX_VISIBLE)
      })
      if (timers.current[id]) clearTimeout(timers.current[id])
      timers.current[id] = setTimeout(() => dismissToast(id), duration)
    },
    [dismissToast],
  )

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SafeAreaView
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        edges={['top']}
      >
        <View pointerEvents="box-none" style={{ padding: spacing[3], gap: spacing[2] }}>
          {toasts.map((toast) => (
            <Pressable
              key={toast.id}
              onPress={() => dismissToast(toast.id)}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: borderFor(toast.type, colors),
                borderRadius: radius.md,
                padding: spacing[3],
                gap: 2,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Text variant="caption" weight="semibold">
                {toast.title}
              </Text>
              {toast.message ? (
                <Text variant="caption" tone="secondary">
                  {toast.message}
                </Text>
              ) : null}
              {toast.nextUp ? (
                <Text variant="meta" tone="tertiary">
                  Next up: {toast.nextUp}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

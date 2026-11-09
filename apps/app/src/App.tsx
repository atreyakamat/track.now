import { BrowserRouter } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/features/notifications/ToastContext'
import { AppRoutes } from '@/routes'
import { UnconfiguredNotice } from '@/components/UnconfiguredNotice'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function App() {
  if (!isSupabaseConfigured) {
    return <UnconfiguredNotice />
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

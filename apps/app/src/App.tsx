import { BrowserRouter } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/features/notifications/ToastContext'
import { AppRoutes } from '@/routes'
import { UnconfiguredNotice } from '@/components/UnconfiguredNotice'

export function App() {
  if (!isSupabaseConfigured) {
    return <UnconfiguredNotice />
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

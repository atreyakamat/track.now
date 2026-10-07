import { BrowserRouter } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AppRoutes } from '@/routes'
import { UnconfiguredNotice } from '@/components/UnconfiguredNotice'

export function App() {
  if (!isSupabaseConfigured) {
    return <UnconfiguredNotice />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

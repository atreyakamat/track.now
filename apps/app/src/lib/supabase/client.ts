import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { writeRecoveryMarker } from '@/features/auth/recoveryMarker'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const looksConfigured = (value: string | undefined): value is string =>
  Boolean(value) && !String(value).includes('your-')

export const isSupabaseConfigured = looksConfigured(url) && looksConfigured(anonKey)

/**
 * The single Supabase client. Only the public anon key is used in the browser;
 * authorization is enforced by Postgres Row Level Security.
 *
 * When env vars are missing, `<App />` renders a configuration screen instead of
 * mounting anything that touches this client, so the `null` branch is never used.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE: email links carry a one-time `?code=` that can only be exchanged by the
        // browser that started the flow (its code verifier is in this device's storage).
        // The implicit flow accepted any `#access_token=…` fragment, so a crafted link could
        // silently sign a victim into an attacker's account (login CSRF).
        flowType: 'pkce',
      },
    })
  : (null as unknown as SupabaseClient)

// Subscribe at module load, before the client finishes reading the email link: auth-js
// emits PASSWORD_RECOVERY while initialising, which can happen before React subscribes.
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user?.id) writeRecoveryMarker(session.user.id)
  })
}

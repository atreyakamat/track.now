import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import { configureSupabase } from '@tracknow/core/lib/supabase'
import { configureAuth } from '@tracknow/core/auth/authService'
import { installStorage } from './storage'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

const looksConfigured = (value: string | undefined): value is string =>
  Boolean(value) && !String(value).includes('your-')

export const isSupabaseConfigured = looksConfigured(url) && looksConfigured(anonKey)

/**
 * The single Supabase client for the mobile app. The session persists in AsyncStorage
 * (not the browser's localStorage), and email links are not parsed from a URL — the app
 * handles password recovery through a deep link instead. Authorization is enforced by
 * Postgres Row Level Security; only the public anon key is shipped.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null

/**
 * Registers the client, device storage and auth redirect with @tracknow/core, and wires
 * token auto-refresh to the app's foreground/background state (per Supabase's RN guidance).
 * Call once at startup before rendering anything that touches core services.
 */
export function installSupabase(): void {
  installStorage()
  configureSupabase(supabase)
  configureAuth({
    // The recovery link opens the app via its deep-link scheme (see app.json `scheme`).
    passwordResetRedirectTo: () => 'tracknow://reset-password',
  })

  if (!supabase) return
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

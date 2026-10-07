import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (null as unknown as SupabaseClient)

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The single Supabase client used by every core service. Each app creates its own client
 * (the web app needs PKCE email links; the mobile app needs device storage for the session)
 * and registers it here once at startup, before any service is called.
 *
 * `supabase` is a live ES module binding, so services always see the registered client.
 */
export let supabase: SupabaseClient = null as unknown as SupabaseClient
export let isSupabaseConfigured = false

export function configureSupabase(client: SupabaseClient | null): void {
  supabase = client as SupabaseClient
  isSupabaseConfigured = client !== null
}

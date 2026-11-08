import { supabase } from '../lib/supabase'

export const DELETE_NEEDS_MIGRATION_MESSAGE =
  'Account deletion needs the latest database update (migration 20261109000000). Until then, email the owner to have your account removed.'

/**
 * Permanently deletes the signed-in user's account and every row it owns, through a
 * SECURITY DEFINER RPC that only ever acts on auth.uid(). The local session is cleared after.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('track_now_delete_my_account')
  if (error) {
    if (error.code === '42883' || /function .* does not exist|schema cache/i.test(error.message)) throw new Error(DELETE_NEEDS_MIGRATION_MESSAGE)
    throw new Error(error.message)
  }
  await supabase.auth.signOut({ scope: 'local' })
}

import { supabase } from '@/lib/supabase/client'
import type { Profile, Track, NewTrackInput } from '@/types/domain'
import { unwrap } from './helpers'

export async function listTracks(): Promise<Track[]> {
  return unwrap(
    await supabase.from('track_now_tracks').select('*').order('created_at', { ascending: true }),
  ) as Track[]
}

export async function getTrack(trackId: string): Promise<Track> {
  return unwrap(
    await supabase.from('track_now_tracks').select('*').eq('id', trackId).single(),
  ) as Track
}

export async function createTrack(userId: string, input: NewTrackInput): Promise<Track> {
  return unwrap(
    await supabase
      .from('track_now_tracks')
      .insert({ ...input, user_id: userId })
      .select()
      .single(),
  ) as Track
}

export async function updateTrack(trackId: string, updates: Partial<NewTrackInput>): Promise<Track> {
  return unwrap(
    await supabase
      .from('track_now_tracks')
      .update(updates)
      .eq('id', trackId)
      .select()
      .single(),
  ) as Track
}

export async function setTrackArchived(trackId: string, archived: boolean): Promise<void> {
  unwrap(
    await supabase
      .from('track_now_tracks')
      .update({
        status: archived ? 'archived' : 'active',
        archived_at: archived ? new Date().toISOString() : null,
      })
      .eq('id', trackId)
      .select('id')
      .single(),
  )
}

export async function deleteTrack(trackId: string): Promise<void> {
  unwrap(
    await supabase.from('track_now_tracks').delete().eq('id', trackId).select('id').single(),
  )
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('track_now_profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

export async function ensureProfile(userId: string, displayName: string | null): Promise<Profile> {
  const existing = await getProfile(userId)
  if (existing) return existing
  const { data: userData } = await supabase.auth.getUser()
  const email = userData?.user?.email || ''
  return unwrap(
    await supabase
      .from('track_now_profiles')
      .insert({ id: userId, full_name: displayName, email })
      .select()
      .single(),
  ) as Profile
}

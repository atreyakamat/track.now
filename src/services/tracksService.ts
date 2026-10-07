import { supabase } from '@/lib/supabase/client'
import type { Profile, Track, NewTrackInput, TemplateType, TrackTemplate } from '@/types/domain'
import { DEFAULT_TRACK_TEMPLATES } from '@/constants/trackTemplates'
import { unwrap } from './helpers'

function mapTrackRow(row: Track & { template_key?: string | null }): Track {
  const templateType = (row.template_key || row.template_type || 'custom') as TemplateType
  return {
    ...row,
    template_type: templateType,
    template_key: row.template_key ?? (templateType !== 'custom' ? templateType : null),
  }
}

export async function listTracks(): Promise<Track[]> {
  const rows = unwrap(
    await supabase.from('track_now_tracks').select('*').order('created_at', { ascending: true }),
  ) as Array<Track & { template_key?: string | null }>
  return rows.map(mapTrackRow)
}

export async function listTrackTemplates(): Promise<TrackTemplate[]> {
  const { data, error } = await supabase
    .from('track_now_track_templates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data || data.length === 0) {
    return DEFAULT_TRACK_TEMPLATES.map((t, idx) => ({
      id: `fallback-${idx}`,
      ...t,
    }))
  }

  return data.map((d) => ({
    id: d.id,
    key: d.key,
    template_type: d.key as TemplateType,
    name: d.name,
    description: d.description,
    icon: d.icon,
    color: d.color,
    default_items: Array.isArray(d.default_items) ? d.default_items : [],
    suggested_areas: [],
  }))
}

export async function getTrack(trackId: string): Promise<Track> {
  const row = unwrap(
    await supabase.from('track_now_tracks').select('*').eq('id', trackId).single(),
  ) as Track & { template_key?: string | null }
  return mapTrackRow(row)
}

export async function createTrack(userId: string, input: NewTrackInput): Promise<Track> {
  const templateKey =
    input.template_key ||
    (input.template_type && input.template_type !== 'custom' ? input.template_type : null)

  const payload = {
    user_id: userId,
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    is_template: Boolean(templateKey),
    template_key: templateKey,
  }

  const row = unwrap(
    await supabase
      .from('track_now_tracks')
      .insert(payload)
      .select()
      .single(),
  ) as Track & { template_key?: string | null }

  return mapTrackRow(row)
}

export async function updateTrack(trackId: string, updates: Partial<NewTrackInput>): Promise<Track> {
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.icon !== undefined) payload.icon = updates.icon
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.template_key !== undefined) {
    payload.template_key = updates.template_key
    payload.is_template = Boolean(updates.template_key)
  } else if (updates.template_type !== undefined) {
    const key = updates.template_type !== 'custom' ? updates.template_type : null
    payload.template_key = key
    payload.is_template = Boolean(key)
  }

  const row = unwrap(
    await supabase
      .from('track_now_tracks')
      .update(payload)
      .eq('id', trackId)
      .select()
      .single(),
  ) as Track & { template_key?: string | null }

  return mapTrackRow(row)
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

export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string | null
    full_name?: string | null
    theme_preference?: 'system' | 'light' | 'dark'
    avatar_url?: string | null
  },
): Promise<Profile> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  const nameToUpdate = updates.full_name !== undefined ? updates.full_name : updates.display_name
  if (nameToUpdate !== undefined) {
    payload.full_name = nameToUpdate
  }
  if (updates.theme_preference !== undefined) {
    payload.theme_preference = updates.theme_preference
  }
  if (updates.avatar_url !== undefined) {
    payload.avatar_url = updates.avatar_url
  }

  const row = unwrap(
    await supabase
      .from('track_now_profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single(),
  ) as Profile

  return row
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

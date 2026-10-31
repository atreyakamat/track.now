import type { TemplateType, Track } from '../types/domain'

/** An existing Track that the new one would duplicate (same name, or same non-custom template). */
export function findDuplicateTrack(tracks: Track[], name: string, template: TemplateType): Track | null {
  const wanted = name.trim().toLowerCase()
  return (
    tracks.find(
      (t) =>
        t.name.trim().toLowerCase() === wanted ||
        (template !== 'custom' && t.template_type === template),
    ) ?? null
  )
}

export type DuplicateCheckResult =
  | { ok: true; duplicate: Track | null }
  | { ok: false; error: string }

/**
 * Runs the duplicate-name check against a *fresh* Track list at submit time.
 * If the list cannot be loaded the check fails closed (no create), instead of
 * silently treating the user as having no Tracks.
 */
export async function checkForDuplicateTrack(
  loadTracks: () => Promise<Track[]>,
  name: string,
  template: TemplateType,
): Promise<DuplicateCheckResult> {
  try {
    const tracks = await loadTracks()
    return { ok: true, duplicate: findDuplicateTrack(tracks, name, template) }
  } catch (err) {
    const reason = err instanceof Error && err.message ? ` (${err.message})` : ''
    return {
      ok: false,
      error: `Could not check your existing Tracks${reason}, so nothing was created. Please try again.`,
    }
  }
}

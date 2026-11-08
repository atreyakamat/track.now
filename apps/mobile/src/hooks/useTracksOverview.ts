import { listCompletionsForDate } from '@tracknow/core/services/executionService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listItemSummaries } from '@tracknow/core/services/plansService'
import { listTracks } from '@tracknow/core/services/tracksService'
import { summarizeTrack, type TrackSummary } from '@tracknow/core/domain/progress'
import { groupArcs, type ArcSummary } from '@tracknow/core/domain/arcs'
import { useAsync, type AsyncState } from './useAsync'

export interface TracksOverview {
  active: TrackSummary[]
  archived: TrackSummary[]
  /** Plans grouped across active Tracks by Arc name. */
  arcs: ArcSummary[]
}

/** Loads every track with its computed progress (habits counted against today), plus Arcs. */
export function useTracksOverview(userId: string | undefined): AsyncState<TracksOverview> {
  return useAsync<TracksOverview>(async () => {
    if (!userId) return { active: [], archived: [], arcs: [] }
    const [tracks, plans, items, completedToday] = await Promise.all([
      listTracks(),
      listPlans(),
      listItemSummaries(),
      listCompletionsForDate(userId),
    ])
    const options = { completedTodayIds: completedToday }
    const summaries = tracks.map((track) => summarizeTrack(track, plans, items, options))
    const activeTrackIds = new Set(tracks.filter((t) => t.status === 'active').map((t) => t.id))
    return {
      active: summaries.filter((s) => s.track.status === 'active'),
      archived: summaries.filter((s) => s.track.status === 'archived'),
      arcs: groupArcs(plans.filter((p) => activeTrackIds.has(p.track_id)), items, new Date(), options),
    }
  }, [userId], { cacheKey: userId ? `tracks_${userId}` : undefined })
}

import { listCompletionsForDate } from '@tracknow/core/services/executionService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listItemSummaries } from '@tracknow/core/services/plansService'
import { listTracks } from '@tracknow/core/services/tracksService'
import { summarizeTrack, type TrackSummary } from '@tracknow/core/domain/progress'
import { useAsync, type AsyncState } from './useAsync'

export interface TracksOverview {
  active: TrackSummary[]
  archived: TrackSummary[]
}

/** Loads every track with its computed progress (habits counted against today). */
export function useTracksOverview(userId: string | undefined): AsyncState<TracksOverview> {
  return useAsync<TracksOverview>(async () => {
    if (!userId) return { active: [], archived: [] }
    const [tracks, plans, items, completedToday] = await Promise.all([
      listTracks(),
      listPlans(),
      listItemSummaries(),
      listCompletionsForDate(userId),
    ])
    const options = { completedTodayIds: completedToday }
    const summaries = tracks.map((track) => summarizeTrack(track, plans, items, options))
    return {
      active: summaries.filter((s) => s.track.status === 'active'),
      archived: summaries.filter((s) => s.track.status === 'archived'),
    }
  }, [userId])
}

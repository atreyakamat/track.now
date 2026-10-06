import { useEffect, useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { listTracks, setTrackArchived } from '@/services/tracksService'
import { listItemSummaries, listPlans } from '@/services/plansService'
import { summarizeTrack, type TrackSummary } from '@/domain/progress'
import { ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui'
import { TrackCard } from '@/components/tracks/TrackCard'

export function TracksPage() {
  const [summaries, setSummaries] = useState<TrackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [tracks, plans, items] = await Promise.all([
        listTracks(),
        listPlans(),
        listItemSummaries(),
      ])
      const trackSummaries = tracks.map((track) => summarizeTrack(track, plans, items))
      setSummaries(trackSummaries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleArchive = async (trackId: string, currentStatus: string) => {
    try {
      setBusyTrackId(trackId)
      await setTrackArchived(trackId, currentStatus !== 'archived')
      await loadData()
    } catch (err) {
      console.error('Failed to update track archive state:', err)
    } finally {
      setBusyTrackId(null)
    }
  }

  const activeTracks = summaries.filter((s) => s.track.status === 'active')
  const archivedTracks = summaries.filter((s) => s.track.status === 'archived')
  const displayTracks = tab === 'active' ? activeTracks : archivedTracks

  return (
    <div>
      <PageHeader
        title="Tracks"
        description="Major areas of life. Each Track houses execution Plans, projects, routines, and progress."
        actions={
          <ButtonLink to="/tracks/new" variant="primary">
            <Plus size={16} />
            <span>Create Track</span>
          </ButtonLink>
        }
      />

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Tabs
          label="Track Status Filter"
          tabs={[
            { id: 'active', label: `Active (${activeTracks.length})` },
            { id: 'archived', label: `Archived (${archivedTracks.length})` },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'active' | 'archived')}
        />
      </div>

      {loading && <LoadingState label="Loading tracks…" />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && (
        <>
          {displayTracks.length === 0 ? (
            <EmptyState
              icon={<Target size={24} />}
              title={tab === 'active' ? 'No active Tracks' : 'No archived Tracks'}
              description={
                tab === 'active'
                  ? 'Tracks represent major areas like Fitness, Career, or Finance. Choose a template or create a custom Track.'
                  : 'Tracks you archive will be kept here safely for future reference and can be restored at any time.'
              }
              action={
                tab === 'active' ? (
                  <ButtonLink to="/tracks/new" variant="primary">
                    <Plus size={16} /> Create Your First Track
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <div className="grid">
              {displayTracks.map((summary) => (
                <TrackCard
                  key={summary.track.id}
                  summary={summary}
                  onToggleArchive={handleToggleArchive}
                  busy={busyTrackId === summary.track.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { listTracks } from '@/services/tracksService'
import { setTrackArchivedWithCleanup } from '@/services/trackLifecycle'
import { listCompletionsForDate } from '@/services/executionService'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { listItemSummaries, listPlans } from '@/services/plansService'
import { summarizeTrack, type TrackSummary } from '@/domain/progress'
import { ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { TrackCard } from '@/components/tracks/TrackCard'

export function TracksPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [summaries, setSummaries] = useState<TrackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null)

  // Only the most recent load may write state (a reload after archiving can race the
  // initial load or a user switch); bumped on unmount so late responses are dropped.
  const requestRef = useRef(0)

  const loadData = async (opts: { silent?: boolean } = {}) => {
    const requestId = ++requestRef.current
    try {
      if (!opts.silent) setLoading(true)
      setError(null)
      const [tracks, plans, items, completedTodayIds] = await Promise.all([
        listTracks(),
        listPlans(),
        listItemSummaries(),
        user ? listCompletionsForDate(user.id) : Promise.resolve([] as string[]),
      ])
      const options = { completedTodayIds: new Set(completedTodayIds) }
      const trackSummaries = tracks.map((track) => summarizeTrack(track, plans, items, options))
      if (requestId !== requestRef.current) return
      setSummaries(trackSummaries)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load tracks')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    return () => {
      requestRef.current += 1
    }
  }, [user?.id])

  const handleToggleArchive = async (trackId: string, currentStatus: string) => {
    try {
      setBusyTrackId(trackId)
      await setTrackArchivedWithCleanup(user?.id, trackId, currentStatus !== 'archived')
      await loadData({ silent: true })
    } catch (err) {
      showToast({
        title: 'Could not update the Track',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
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
            <Plus size={16} aria-hidden="true" />
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

      <TabPanel id={tab} active={tab}>
        {loading && <LoadingState label="Loading tracks…" />}
        {error && <ErrorState message={error} onRetry={() => void loadData()} />}

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
                      <Plus size={16} aria-hidden="true" /> Create Your First Track
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
      </TabPanel>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { listTracks } from '@tracknow/core/services/tracksService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listCompletionsForDate, listExecutionItems } from '@tracknow/core/services/executionService'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { ANALYTICS_HISTORY_DAYS } from '@tracknow/core/domain/analytics'
import { arcKey, groupArcs } from '@tracknow/core/domain/arcs'
import { summarizePlan } from '@tracknow/core/domain/progress'
import { formatDateRange } from '@tracknow/core/utils/format'
import type { ExecutionItem, Plan, Track } from '@tracknow/core/types/domain'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar } from '@/components/ui'
import { PlanCard } from '@/components/plans/PlanCard'
import { RetentionPanel } from '@/components/insights/RetentionPanel'
import '@/styles/insights.css'

interface Loaded {
  tracks: Track[]
  plans: Plan[]
  items: ExecutionItem[]
  completions: CompletionRecord[]
  completedTodayIds: string[]
  loadedAt: Date
}

/** One Arc: every Plan carrying the same Arc name, across Tracks, with its retention. */
export function ArcPage() {
  const { arcKey: rawKey = '' } = useParams()
  const key = arcKey(decodeURIComponent(rawKey))
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!userId) return
    setError(null)
    try {
      const now = new Date()
      const today = getTodayDateString(now)
      const [tracks, plans, items, completions, completedTodayIds] = await Promise.all([
        listTracks(),
        listPlans(),
        listExecutionItems(),
        listCompletionHistory(userId, addDays(today, -(ANALYTICS_HISTORY_DAYS - 1)), today),
        listCompletionsForDate(userId, today),
      ])
      if (requestId !== requestRef.current) return
      setData({ tracks, plans, items, completions, completedTodayIds, loadedAt: now })
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Could not load this Arc.')
    }
  }, [userId])

  useEffect(() => {
    void load()
    return () => {
      requestRef.current += 1
    }
  }, [load])

  const view = useMemo(() => {
    if (!data) return null
    const options = { completedTodayIds: new Set(data.completedTodayIds) }
    const arc = groupArcs(data.plans, data.items, data.loadedAt, options).find((a) => a.key === key)
    if (!arc) return { arc: null }
    const trackById = new Map(data.tracks.map((t) => [t.id, t]))
    const byTrack = arc.trackIds
      .map((id) => ({
        track: trackById.get(id),
        plans: arc.plans.filter((p) => p.track_id === id).map((p) => summarizePlan(p, data.items, options)),
      }))
      .sort((a, b) => (a.track?.name ?? '').localeCompare(b.track?.name ?? ''))
    const today = getTodayDateString(data.loadedAt)
    const start = arc.start && arc.start <= today ? arc.start : null
    const weeks = start ? Math.min(24, Math.floor((Date.parse(today) - Date.parse(start)) / (7 * 86_400_000)) + 2) : 4
    return { arc, byTrack, planIds: new Set(arc.plans.map((p) => p.id)), start, weeks }
  }, [data, key])

  if (error) return <ErrorState title="Could not load this Arc" message={error} onRetry={() => void load()} />
  if (!view) return <LoadingState label="Loading the Arc…" />
  if (!view.arc) {
    return (
      <EmptyState
        icon={<Layers size={20} />}
        title="Arc not found"
        description="No Plan belongs to this Arc any more. Set “Part of an Arc” when creating or editing a Plan to group Plans from different Tracks."
      />
    )
  }
  const { arc, byTrack, planIds, start, weeks } = view
  const t = arc.timeline

  return (
    <div>
      <PageHeader
        back={{ to: '/tracks', label: 'Tracks' }}
        eyebrow="Arc"
        title={arc.name}
        description={`${arc.plans.length} Plans across ${arc.trackIds.length} Tracks${arc.start || arc.end ? ` · ${formatDateRange(arc.start, arc.end)}` : ''}`}
      />

      <section className="card stack" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }} aria-label="Arc overview">
        {t && (
          <div className="stack" style={{ gap: 'var(--space-1)' }}>
            <span className="t-h3">
              {t.phase === 'not_started'
                ? `Starts in ${t.startsInDays} ${t.startsInDays === 1 ? 'day' : 'days'}`
                : t.phase === 'ended'
                  ? `Ended · ${t.totalDays} days`
                  : `Day ${t.day} of ${t.totalDays}`}
            </span>
            <ProgressBar percent={t.elapsedPercent} label="Time elapsed" />
          </div>
        )}
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <span className="t-meta">
            {arc.progress.done} of {arc.progress.total} items done
            {arc.status === 'completed' ? ' (all Plans completed)' : ''}
          </span>
          <ProgressBar percent={arc.progress.percent} label="Arc progress" />
        </div>
      </section>

      <section className="section" aria-labelledby="arc-plans-heading">
        <div className="section__head">
          <h2 id="arc-plans-heading" className="t-h2">
            Plans in this Arc
          </h2>
        </div>
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          {byTrack.map(({ track, plans }) => (
            <div key={track?.id ?? 'unknown'} className="stack" style={{ gap: 'var(--space-2)' }}>
              <h3 className="t-h3">{track?.name ?? 'Track'}</h3>
              <div className="plan-list">
                {plans.map((summary) => (
                  <PlanCard key={summary.plan.id} summary={summary} trackColor={track?.color} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {data && (
        <RetentionPanel
          idPrefix="arc-retention"
          items={data.items}
          plans={data.plans}
          tracks={data.tracks}
          completions={data.completions}
          now={data.loadedAt}
          planIds={planIds}
          since={start}
          weeks={weeks}
        />
      )}
    </div>
  )
}

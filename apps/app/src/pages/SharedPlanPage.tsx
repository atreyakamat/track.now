import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { getSharedPlan, type SharedPlanView } from '@tracknow/core/services/shareService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { planTimeline } from '@tracknow/core/domain/plans'
import { addDaysTo, isFixedScheduleDay, weekStartOf, weeklyTarget } from '@tracknow/core/domain/schedule'
import { Badge, EmptyState, LoadingState, ProgressBar } from '@/components/ui'
import { BrandMark } from '@/components/ui/BrandMark'

/** Public, read-only view of one shared Plan (accountability partner / coach). No sign-in needed. */
export function SharedPlanPage() {
  const { token = '' } = useParams()
  const [data, setData] = useState<SharedPlanView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // The link itself is the secret: keep it out of search engines and out of the Referer header
  // of anything opened from this page.
  useEffect(() => {
    const tags = [
      ['robots', 'noindex, nofollow, noarchive'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const meta = document.createElement('meta')
      meta.name = name
      meta.content = content
      document.head.appendChild(meta)
      return meta
    })
    return () => tags.forEach((m) => m.remove())
  }, [])

  useEffect(() => {
    let alive = true
    getSharedPlan(token)
      .then((v) => alive && setData(v))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load this link.'))
    return () => {
      alive = false
    }
  }, [token])

  const view = useMemo(() => {
    if (!data) return null
    const today = getTodayDateString()
    const weekStart = weekStartOf(today)
    const doneSet = new Set(data.completions.map((c) => `${c.item_id}|${c.completed_date}`))
    const habits = data.items.filter((i) => i.type === 'habit')
    const others = data.items.filter((i) => i.type !== 'habit')
    // This week's planned habit days vs done (fixed-day habits), plus weekly-target sessions.
    let planned = 0
    let done = 0
    for (const h of habits) {
      const target = weeklyTarget(h.schedule)
      if (target !== null) {
        const sessions = data.completions.filter((c) => c.item_id === h.id && c.completed_date >= weekStart && c.completed_date <= today).length
        planned += target
        done += Math.min(target, sessions)
        continue
      }
      for (let d = weekStart; d <= today; d = addDaysTo(d, 1)) {
        if (h.start_date && d < h.start_date) continue
        if (!isFixedScheduleDay(h.schedule, d)) continue
        planned++
        if (doneSet.has(`${h.id}|${d}`)) done++
      }
    }
    const activeDays = new Set(data.completions.map((c) => c.completed_date)).size
    return { today, habits, others, planned, done, activeDays, doneSet, timeline: planTimeline(data.plan) }
  }, [data])

  return (
    <div className="auth" style={{ alignItems: 'flex-start', paddingTop: 'var(--space-6)' }}>
      <div className="auth__card" style={{ maxWidth: 640, width: '100%' }}>
        <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <BrandMark size={28} />
          <span className="t-h3">Track.now</span>
          <span className="t-meta" style={{ marginLeft: 'auto' }}>
            <Lock size={12} aria-hidden="true" /> Shared, read-only
          </span>
        </div>

        {data === undefined && !error && <LoadingState label="Opening the shared Plan…" />}
        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}
        {data === null && (
          <EmptyState title="This link is no longer active" description="The owner may have revoked it, or the link was copied incorrectly." />
        )}

        {data && view && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="t-meta">
                {data.owner_name ? `${data.owner_name}’s Plan` : 'A Plan'}
                {data.track ? ` · ${data.track.name}` : ''}
                {data.plan.arc_name ? ` · ${data.plan.arc_name}` : ''}
              </span>
              <h1 className="t-h1">{data.plan.name}</h1>
              {data.plan.description && <p className="t-caption">{data.plan.description}</p>}
              {data.plan.outcome && (
                <p className="t-caption">
                  <strong>Aim:</strong> {data.plan.outcome}
                </p>
              )}
            </div>

            {view.timeline && (
              <div className="stack" style={{ gap: 4 }}>
                <span className="t-caption">
                  {view.timeline.phase === 'not_started' ? `Starts in ${view.timeline.startsInDays} days` : view.timeline.phase === 'ended' ? 'Ended' : `Day ${view.timeline.day} of ${view.timeline.totalDays}`}
                </span>
                <ProgressBar percent={view.timeline.elapsedPercent} label="Time elapsed" hideValue />
              </div>
            )}

            <div className="progress-panel">
              <div className="card progress-panel__card">
                <span className="t-meta">This week</span>
                <span className="progress-panel__value">
                  {view.done}/{view.planned}
                </span>
                <span className="t-meta">habit sessions done</span>
              </div>
              <div className="card progress-panel__card">
                <span className="t-meta">Last 90 days</span>
                <span className="progress-panel__value">{view.activeDays}</span>
                <span className="t-meta">active days</span>
              </div>
            </div>

            {view.habits.length > 0 && (
              <section className="stack" style={{ gap: 'var(--space-2)' }}>
                <h2 className="t-h3">Habits</h2>
                {view.habits.map((h) => {
                  const last7 = Array.from({ length: 7 }, (_, i) => addDaysTo(view.today, -(6 - i)))
                  return (
                    <div key={h.id} className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <span className="t-caption" style={{ flex: 1, minWidth: 0 }}>
                        {h.name}
                      </span>
                      <span className="row" style={{ gap: 3 }} aria-label={`${h.name}, last 7 days`}>
                        {last7.map((d) => (
                          <span
                            key={d}
                            className="share-dot"
                            data-done={view.doneSet.has(`${h.id}|${d}`) ? 'true' : 'false'}
                            data-planned={weeklyTarget(h.schedule) !== null || isFixedScheduleDay(h.schedule, d) ? 'true' : 'false'}
                            title={d}
                          />
                        ))}
                      </span>
                    </div>
                  )
                })}
              </section>
            )}

            {view.others.length > 0 && (
              <section className="stack" style={{ gap: 'var(--space-2)' }}>
                <h2 className="t-h3">Tasks and milestones</h2>
                {view.others.map((i) => (
                  <div key={i.id} className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <span className="t-caption" style={{ textDecoration: i.status === 'done' ? 'line-through' : 'none', flex: 1, minWidth: 0 }}>
                      <Badge>{i.type}</Badge> {i.name}
                    </span>
                    <span className="t-meta">{i.status === 'done' ? 'Done' : i.due_date ? `Due ${i.due_date}` : ''}</span>
                  </div>
                ))}
              </section>
            )}

            <p className="t-meta">
              Shared from Track.now. <Link to="/signup">Make your own</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ExecutionItem, Plan, Track } from '@tracknow/core/types/domain'
import {
  ON_TRACK_PERCENT,
  RETENTION_STATUS_LABEL,
  buildRetention,
  type HabitRetention,
  type HabitRetentionStatus,
  type RetentionCompletion,
  type WeekConsistency,
} from '@tracknow/core/domain/retention'
import { Badge } from '@/components/ui'
import { pluralize } from '@tracknow/core/utils/format'
import { getTodayDateString } from '@tracknow/core/domain/dates'

interface RetentionPanelProps {
  items: ExecutionItem[]
  plans: Plan[]
  tracks: Track[]
  completions: RetentionCompletion[]
  now: Date
  weeks?: number
  /** Restrict to these Plans (an Arc). */
  planIds?: Set<string>
  /** Never count before this date (an Arc's start). */
  since?: string | null
  /** Heading level id prefix, so the panel can appear on several pages. */
  idPrefix?: string
}

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const STATUS_GROUPS: HabitRetentionStatus[] = ['dropped', 'slipping', 'kept', 'new', 'not_started']
const STATUS_HINT: Record<HabitRetentionStatus, string> = {
  dropped: 'Scheduled in the last 14 days but not done once.',
  slipping: `Below ${ON_TRACK_PERCENT}% over the last 14 days.`,
  kept: `At least ${ON_TRACK_PERCENT}% over the last 14 days.`,
  new: 'Tracked for less than 14 days — too early to judge.',
  not_started: 'Starts later.',
}

/**
 * Retention: are you sticking with what you planned? A week-by-week consistency trend, how each
 * Plan is holding up, and which habits you are keeping, slipping on or have dropped.
 */
export function RetentionPanel({ items, plans, tracks, completions, now, weeks = 12, planIds, since, idPrefix = 'retention' }: RetentionPanelProps) {
  const result = useMemo(
    () => buildRetention({ items, plans, completions, now, weeks, planIds, since }),
    [items, plans, completions, now, weeks, planIds, since],
  )
  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  const hasData = result.weeks.some((w) => w.planned > 0) || result.habits.length > 0
  const headingId = `${idPrefix}-heading`

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section__head">
        <h2 id={headingId} className="t-h2">
          Retention
        </h2>
      </div>
      {!hasData ? (
        <p className="t-meta">
          Nothing to measure yet. Once habits and dated tasks in your active Plans are underway, this shows whether you are
          sticking with them week after week.
        </p>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <div className="progress-panel">
            <div className="card progress-panel__card">
              <span className="t-meta">Habits you're keeping</span>
              <span className="progress-panel__value">
                {result.established ? `${result.kept} of ${result.established}` : '—'}
              </span>
              <span className="t-meta">
                {result.established
                  ? `Habits tracked 14+ days that are at ${ON_TRACK_PERCENT}% or better over the last two weeks.`
                  : 'Habits are judged once they have been tracked for 14 days.'}
              </span>
            </div>
            <div className="card progress-panel__card">
              <span className="t-meta">Planned work done ({result.weeks.length} weeks)</span>
              <span className="progress-panel__value">
                {result.percent === null ? '—' : `${result.percent}%`} <TrendBadge trend={result.trend} />
              </span>
              <span className="t-meta">
                {result.trend === null
                  ? 'The trend appears after four finished weeks.'
                  : 'Trend compares your last two finished weeks with the two before.'}
              </span>
            </div>
          </div>

          <div className="card insights-card">
            <h3 className="t-h3">Weekly consistency</h3>
            <WeekBars weeks={result.weeks} label="Planned work done each week" />
            <p className="t-caption">
              Each bar is one Mon–Sun week: scheduled habit days, weekly-target sessions and tasks due that week. The line marks{' '}
              {ON_TRACK_PERCENT}%. This week only counts days so far.
            </p>
          </div>

          {result.byPlan.length > 0 && (
            <div className="card insights-card">
              <h3 className="t-h3">By Plan</h3>
              <ul className="insights-list">
                {result.byPlan.map(({ plan, weeks: pw, percent }) => {
                  const track = trackById.get(plan.track_id)
                  return (
                    <li key={plan.id} className="insights-list__item">
                      <div className="insights-list__main">
                        <Link to={`/tracks/${plan.track_id}/plans/${plan.id}`} className="insights-list__title" style={{ color: 'var(--text-primary)' }}>
                          {plan.name}
                        </Link>
                        <span className="insights-list__meta">{track?.name ?? 'Track'}</span>
                      </div>
                      <MiniBars weeks={pw.slice(-8)} label={`${plan.name}, last 8 weeks`} />
                      <span className="retention-pct">{percent}%</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {result.habits.length > 0 && (
            <div className="card insights-card">
              <h3 className="t-h3">Habits: kept, slipping or dropped</h3>
              {STATUS_GROUPS.map((status) => {
                const group = result.habits.filter((h) => h.status === status)
                if (!group.length) return null
                return (
                  <div key={status} className="stack" style={{ gap: 'var(--space-2)' }}>
                    <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span className={`retention-status retention-status--${status}`}>
                        {RETENTION_STATUS_LABEL[status]} ({group.length})
                      </span>
                      <span className="t-caption">{STATUS_HINT[status]}</span>
                    </div>
                    <ul className="insights-list">
                      {group.map((h) => (
                        <HabitRow key={h.item.id} habit={h} plan={planById.get(h.item.plan_id)} now={now} />
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function TrendBadge({ trend }: { trend: 'improving' | 'steady' | 'slipping' | null }) {
  if (!trend) return null
  const Icon = trend === 'improving' ? ArrowUpRight : trend === 'slipping' ? ArrowDownRight : ArrowRight
  return (
    <Badge accent={trend === 'improving'}>
      <Icon size={12} aria-hidden="true" /> {trend === 'improving' ? 'Improving' : trend === 'slipping' ? 'Slipping' : 'Steady'}
    </Badge>
  )
}

function WeekBars({ weeks, label }: { weeks: WeekConsistency[]; label: string }) {
  return (
    <ol className="retention-bars" aria-label={label}>
      {weeks.map((w) => {
        const text =
          w.percent === null
            ? `Week of ${shortDate(w.weekStart)}: nothing planned`
            : `Week of ${shortDate(w.weekStart)}${w.partial ? ' (so far)' : ''}: ${w.done} of ${w.planned} done, ${w.percent}%`
        return (
          <li key={w.weekStart} className="retention-bars__col" title={text}>
            <span className="sr-only">{text}</span>
            <span className="retention-bars__track" aria-hidden="true">
              <span className="retention-bars__line" style={{ bottom: `${ON_TRACK_PERCENT}%` }} />
              {w.percent !== null && (
                <span
                  className={`retention-bars__fill${w.partial ? ' retention-bars__fill--partial' : ''}${w.percent < ON_TRACK_PERCENT ? ' retention-bars__fill--low' : ''}`}
                  style={{ height: `${Math.max(w.percent, 3)}%` }}
                />
              )}
            </span>
            <span className="retention-bars__pct" aria-hidden="true">
              {w.percent === null ? '–' : `${w.percent}`}
            </span>
            <span className="retention-bars__label" aria-hidden="true">
              {shortDate(w.weekStart)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function MiniBars({ weeks, label }: { weeks: WeekConsistency[]; label: string }) {
  const described = weeks.map((w) => (w.percent === null ? '–' : `${w.percent}%`)).join(', ')
  return (
    <span className="retention-mini" role="img" aria-label={`${label}: ${described}`}>
      {weeks.map((w) => (
        <span
          key={w.weekStart}
          className={`retention-mini__bar${w.percent !== null && w.percent < ON_TRACK_PERCENT ? ' retention-mini__bar--low' : ''}`}
          style={{ height: w.percent === null ? '2px' : `${Math.max(w.percent, 8)}%`, opacity: w.percent === null ? 0.3 : 1 }}
        />
      ))}
    </span>
  )
}

function HabitRow({ habit, plan, now }: { habit: HabitRetention; plan: Plan | undefined; now: Date }) {
  const { item, recentPercent, previousPercent, weeksOnTrack, bestWeeksOnTrack, lastDone, trackedSince, status } = habit
  const delta = recentPercent !== null && previousPercent !== null ? recentPercent - previousPercent : null
  const today = getTodayDateString(now)
  const details: string[] = []
  if (status === 'not_started' && item.start_date) details.push(`Starts ${shortDate(item.start_date)}`)
  else {
    if (weeksOnTrack > 0) details.push(`On track ${pluralize(weeksOnTrack, 'week')} in a row`)
    if (bestWeeksOnTrack > weeksOnTrack) details.push(`best run ${pluralize(bestWeeksOnTrack, 'week')}`)
    details.push(lastDone ? `last done ${lastDone === today ? 'today' : shortDate(lastDone)}` : 'never done yet')
    if (trackedSince) details.push(`tracked since ${shortDate(trackedSince)}`)
  }
  return (
    <li className="insights-list__item">
      <div className="insights-list__main">
        <Link to={`/tracks/${plan?.track_id ?? ''}/plans/${item.plan_id}`} className="insights-list__title" style={{ color: 'var(--text-primary)' }}>
          {item.name}
        </Link>
        <span className="insights-list__meta">
          {plan?.name ? `${plan.name} · ` : ''}
          {details.join(' · ')}
        </span>
      </div>
      {status !== 'not_started' && (
        <span className="retention-pct" title="Last 14 days (change vs the 14 days before)">
          {recentPercent === null ? '—' : `${recentPercent}%`}
          {delta !== null && delta !== 0 && (
            <span className="t-caption" style={{ marginLeft: 4 }}>
              {delta > 0 ? '▲' : '▼'}
              {Math.abs(delta)}
              <span className="sr-only"> points vs the previous 14 days</span>
            </span>
          )}
        </span>
      )}
    </li>
  )
}

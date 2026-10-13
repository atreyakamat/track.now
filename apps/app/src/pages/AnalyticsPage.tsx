import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { listTracks } from '@/services/tracksService'
import { listPlans } from '@/services/plansService'
import { listCompletionsForDate, listExecutionItems } from '@/services/executionService'
import { listCompletionHistory, type CompletionRecord } from '@/services/historyService'
import { getTodayDateString } from '@/domain/dates'
import { addDays } from '@/domain/streaks'
import {
  ANALYTICS_HISTORY_DAYS,
  ANALYTICS_RANGE_OPTIONS,
  buildAnalytics,
  formatDateRangeLabel,
  formatLocalDate,
  itemDisplayName,
  type AnalyticsRangeDays,
  type AnalyticsResult,
} from '@/domain/analytics'
import type { ExecutionItem, Plan, Track } from '@/types/domain'
import { Badge, ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar } from '@/components/ui'
import { pluralize } from '@/utils/format'
import '@/styles/insights.css'

interface LoadedData {
  tracks: Track[]
  plans: Plan[]
  items: ExecutionItem[]
  completions: CompletionRecord[]
  completedTodayIds: string[]
  loadedAt: Date
}

const RANGE_LABELS: Record<AnalyticsRangeDays, string> = { 7: '7 days', 30: '30 days', 90: '90 days' }
const TYPE_LABELS: Record<string, string> = {
  habit: 'Habit', task: 'Task', checklist: 'Checklist', milestone: 'Milestone', project: 'Project',
}
const dotStyle = (color: string | null | undefined): CSSProperties | undefined =>
  color ? ({ '--dot-color': color } as CSSProperties) : undefined

export function AnalyticsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30)
  const [data, setData] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!userId) {
      setLoading(false)
      setError('Sign in to see your analytics.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const today = getTodayDateString(now)
      const historyStart = addDays(today, -(ANALYTICS_HISTORY_DAYS - 1))
      const [tracks, plans, items, completions, completedTodayIds] = await Promise.all([
        listTracks(),
        listPlans(),
        listExecutionItems(),
        listCompletionHistory(userId, historyStart, today),
        listCompletionsForDate(userId, today),
      ])
      if (requestId !== requestRef.current) return
      setData({ tracks, plans, items, completions, completedTodayIds, loadedAt: now })
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load analytics.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const analytics = useMemo<AnalyticsResult | null>(
    () =>
      data
        ? buildAnalytics({
            tracks: data.tracks,
            plans: data.plans,
            items: data.items,
            completions: data.completions,
            completedTodayIds: data.completedTodayIds,
            now: data.loadedAt,
            rangeDays,
          })
        : null,
    [data, rangeDays],
  )

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="How your execution is actually going — calculated from your real completion history."
      />

      {loading && !analytics && <LoadingState label="Crunching your history…" />}

      {error && (
        <section aria-labelledby="analytics-error-heading">
          <h2 id="analytics-error-heading" className="sr-only">Analytics could not load</h2>
          <ErrorState title="Could not load analytics" message={error} onRetry={() => void load()} />
        </section>
      )}

      {!error && analytics && !analytics.hasAnyData && (
        <section aria-labelledby="analytics-empty-heading">
          <h2 id="analytics-empty-heading" className="sr-only">No data yet</h2>
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="Nothing to analyze yet"
            description="Analytics are built only from your own Tracks, items and completions — there is no sample data. Create a Track, add a habit or task, and complete it to see your first numbers here."
            action={
              <ButtonLink to="/tracks/new" variant="primary">
                <Plus size={16} aria-hidden="true" /> Create a Track
              </ButtonLink>
            }
          />
        </section>
      )}

      {!error && analytics && analytics.hasAnyData && (
        <div className="insights" aria-busy={loading} style={loading ? { opacity: 0.6 } : undefined}>
          <div className="insights-filter">
            <RangeSelector value={rangeDays} onChange={setRangeDays} />
            <span className="t-caption">{formatDateRangeLabel(analytics.range)}</span>
          </div>

          <MethodNote />
          <SummaryTiles analytics={analytics} />

          <section className="section" aria-labelledby="trend-heading">
            <div className="section__head">
              <h2 id="trend-heading" className="t-h2">Completion trend</h2>
            </div>
            <div className="card insights-card">
              <TrendChart analytics={analytics} />
            </div>
          </section>

          <TrackProgressSection analytics={analytics} />
          <HabitSection analytics={analytics} />
          <DayOfWeekSection analytics={analytics} />
          <OverdueSection analytics={analytics} />
          <RecentSection analytics={analytics} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Range selector — a single filter row scoping every section (radiogroup).
// ---------------------------------------------------------------------------

function RangeSelector({ value, onChange }: { value: AnalyticsRangeDays; onChange: (v: AnalyticsRangeDays) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !back) return
    event.preventDefault()
    const count = ANALYTICS_RANGE_OPTIONS.length
    const nextIndex = (index + (forward ? 1 : -1) + count) % count
    onChange(ANALYTICS_RANGE_OPTIONS[nextIndex])
    refs.current[nextIndex]?.focus()
  }
  return (
    <div className="insights-range" role="radiogroup" aria-label="Time range">
      {ANALYTICS_RANGE_OPTIONS.map((option, index) => (
        <button
          key={option}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={value === option}
          tabIndex={value === option ? 0 : -1}
          className="insights-range__opt"
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span aria-hidden="true">{option}d</span>
          <span className="sr-only">Last {RANGE_LABELS[option]}</span>
        </button>
      ))}
    </div>
  )
}

function MethodNote() {
  return (
    <details className="insights-details">
      <summary>How these numbers are calculated</summary>
      <ul className="insights-caption stack" style={{ gap: 'var(--space-2)', listStyle: 'disc', paddingLeft: 'var(--space-5)' }}>
        <li>A completion is one entry in your completion history: one per item per day you completed it.</li>
        <li>Progress counts habits as done only when completed today; other items count when marked done. Archived Tracks and Plans are left out.</li>
        <li>Habit consistency compares the days each habit was scheduled (since it was created) with the days you completed it. Today is not counted as missed while it is still in progress.</li>
        <li>Streaks use the last {ANALYTICS_HISTORY_DAYS} days of history. Comparisons appear only when the previous period has completions to compare with.</li>
        <li>Completions from archived or deleted items still count toward totals and are labeled as such.</li>
      </ul>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Summary tiles
// ---------------------------------------------------------------------------

function SummaryTiles({ analytics }: { analytics: AnalyticsResult }) {
  const { totals, habitTotals, overdue, createdVsCompleted, rangeDays } = analytics
  const comparison = totals.comparison
  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">Summary for the last {rangeDays} days</h2>
      <div className="stat-grid">
        <div className="stat">
          <span className="t-meta">Completions</span>
          <span className="insights-stat__value">{totals.completions}</span>
          {comparison ? (
            <span
              className={`insights-delta insights-delta--${comparison.delta > 0 ? 'up' : comparison.delta < 0 ? 'down' : 'flat'}`}
            >
              {comparison.delta > 0 ? (
                <ArrowUpRight size={14} aria-hidden="true" />
              ) : comparison.delta < 0 ? (
                <ArrowDownRight size={14} aria-hidden="true" />
              ) : null}
              {comparison.delta === 0
                ? 'Same as previous'
                : `${comparison.delta > 0 ? '+' : ''}${comparison.percentChange}% vs previous`}
              <span className="sr-only">
                {' '}
                {rangeDays} days ({comparison.previousCompletions} completions)
              </span>
            </span>
          ) : (
            <span className="insights-stat__sub">No earlier period to compare</span>
          )}
        </div>
        <div className="stat">
          <span className="t-meta">Active days</span>
          <span className="insights-stat__value">{totals.activeDays}</span>
          <span className="insights-stat__sub">of {rangeDays} days</span>
        </div>
        <div className="stat">
          <span className="t-meta">Per active day</span>
          <span className="insights-stat__value">{totals.averagePerActiveDay ?? '—'}</span>
          <span className="insights-stat__sub">
            {totals.averagePerActiveDay === null ? 'No active days yet' : 'average completions'}
          </span>
        </div>
        <div className="stat">
          <span className="t-meta">Habit consistency</span>
          <span className="insights-stat__value">{habitTotals.rate === null ? '—' : `${habitTotals.rate}%`}</span>
          <span className="insights-stat__sub">
            {habitTotals.expected === 0
              ? 'No scheduled habit days yet'
              : `${habitTotals.completed} of ${habitTotals.expected} scheduled`}
          </span>
        </div>
        <div className="stat">
          <span className="t-meta">Created vs done</span>
          <span className="insights-stat__value">
            {createdVsCompleted.created}
            <span className="t-muted" aria-hidden="true"> / </span>
            <span className="sr-only"> items created, </span>
            {createdVsCompleted.completed}
            <span className="sr-only"> completions</span>
          </span>
          <span className="insights-stat__sub">new items / completions</span>
        </div>
        <div className="stat">
          <span className="t-meta">Overdue now</span>
          <span className="insights-stat__value">{overdue.length}</span>
          <span className="insights-stat__sub">{overdue.length === 0 ? 'Nothing past due' : 'open items past due'}</span>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Trend: single-series column chart (plain HTML/CSS) with table twin.
// ---------------------------------------------------------------------------

interface ChartPoint {
  key: string
  count: number
  axisLabel: string
  fullLabel: string
}

function TrendChart({ analytics }: { analytics: AnalyticsResult }) {
  const weekly = analytics.weekly
  const points: ChartPoint[] = weekly
    ? weekly.map((b) => ({
        key: b.start,
        count: b.count,
        axisLabel: formatLocalDate(b.start),
        fullLabel:
          b.days === 7
            ? `Week of ${formatLocalDate(b.start)}`
            : `${formatLocalDate(b.start)} – ${formatLocalDate(b.end)} (${pluralize(b.days, 'day')})`,
      }))
    : analytics.daily.map((d) => ({
        key: d.date,
        count: d.count,
        axisLabel: formatLocalDate(d.date, analytics.rangeDays <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
        fullLabel: formatLocalDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' }),
      }))
  const unit = weekly ? 'week' : 'day'
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const max = points.reduce((m, p) => Math.max(m, p.count), 0)
  const peak = points.find((p) => p.count === max) ?? null
  const active = points.find((p) => p.key === activeKey) ?? null
  const total = analytics.totals.completions

  if (max === 0) {
    return (
      <p className="insights-caption">
        No completions in the last {analytics.rangeDays} days yet. Complete a habit or task and it will show up here.
      </p>
    )
  }

  const summary = `Column chart of completions per ${unit}, ${formatDateRangeLabel(analytics.range)}. ${pluralize(total, 'completion')} in total; the busiest ${unit} was ${peak?.fullLabel} with ${pluralize(max, 'completion')}.`
  const middle = points.length >= 7 ? points[Math.floor(points.length / 2)] : null
  const minWidth = `${points.length * 8 + 48}px`

  return (
    <figure className="insights-chart">
      <figcaption className="insights-caption">
        Completions per {unit}{weekly ? ' (weeks start on Monday; the first and last may be partial)' : ''}.
      </figcaption>
      <p className="insights-chart__readout" aria-hidden="true">
        {active ? (
          <>
            {active.fullLabel} · <strong>{active.count}</strong> {active.count === 1 ? 'completion' : 'completions'}
          </>
        ) : (
          <>
            Busiest {unit}: {peak?.fullLabel} · <strong>{max}</strong>
          </>
        )}
      </p>
      <div className="insights-chart__scroll">
        <div className="insights-chart__frame" role="img" aria-label={summary} style={{ '--chart-min-width': minWidth } as CSSProperties}>
          <div className="insights-chart__yaxis" aria-hidden="true">
            <span>{max}</span>
            <span>0</span>
          </div>
          <div className="insights-chart__plot" aria-hidden="true" onMouseLeave={() => setActiveKey(null)}>
            {points.map((p) => (
              <div
                key={p.key}
                className="insights-chart__col"
                data-active={activeKey === p.key}
                title={`${p.fullLabel}: ${p.count}`}
                onMouseEnter={() => setActiveKey(p.key)}
              >
                <div
                  className={`insights-chart__bar${p === peak ? ' insights-chart__bar--peak' : ''}`}
                  style={{ height: `${(p.count / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="insights-chart__xaxis" aria-hidden="true">
            <span>{points[0]?.axisLabel}</span>
            {middle && <span>{middle.axisLabel}</span>}
            <span>{points[points.length - 1]?.axisLabel}</span>
          </div>
        </div>
      </div>
      <details className="insights-details">
        <summary>Show data table</summary>
        <div className="insights-table-wrap">
          <table className="insights-table">
            <caption>Completions per {unit}</caption>
            <thead>
              <tr>
                <th scope="col">{weekly ? 'Week' : 'Date'}</th>
                <th scope="col" className="num">Completions</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{p.fullLabel}</th>
                  <td className="num">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Track progress
// ---------------------------------------------------------------------------

function TrackProgressSection({ analytics }: { analytics: AnalyticsResult }) {
  const history = analytics.completionsByTrack.filter((r) => !r.isActive)
  return (
    <section className="section" aria-labelledby="tracks-heading">
      <div className="section__head">
        <h2 id="tracks-heading" className="t-h2">Track progress</h2>
        <Link to="/tracks" className="t-caption">All Tracks</Link>
      </div>
      <div className="card insights-card">
        <p className="insights-caption">
          Current progress across each active Track’s active Plans, plus completions logged in the last {analytics.rangeDays} days.
        </p>
        {analytics.trackProgress.length === 0 ? (
          <EmptyState
            title="No active Tracks"
            description="Create or restore a Track to see its progress here."
            action={<ButtonLink to="/tracks/new" size="sm">Create a Track</ButtonLink>}
          />
        ) : (
          <div>
            {analytics.trackProgress.map((row) => (
              <div key={row.track.id} className="insights-track">
                <div className="insights-track__head">
                  <Link to={`/tracks/${row.track.id}`} className="insights-track__name">
                    <span className="insights-dot" style={dotStyle(row.track.color)} aria-hidden="true" />
                    {row.track.name}
                  </Link>
                  <span className="t-caption">{pluralize(row.completionsInRange, 'completion')}</span>
                </div>
                <ProgressBar percent={row.progress.percent} color={row.track.color} label={`${row.track.name} progress`} />
                <span className="t-caption">
                  {row.progress.total === 0
                    ? row.activePlanCount === 0
                      ? 'No active Plans yet'
                      : 'No items yet'
                    : `${row.progress.done} of ${row.progress.total} items done · ${pluralize(row.activePlanCount, 'active Plan')}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <h3 className="t-h3">History from archived or deleted items</h3>
            <ul className="insights-list">
              {history.map((row) => (
                <li key={row.trackId ?? 'unknown'} className="insights-list__item">
                  <span className="insights-track__name">
                    <span className="insights-dot" style={dotStyle(row.color)} aria-hidden="true" />
                    {row.name}
                    {row.trackId && <Badge>Archived</Badge>}
                  </span>
                  <span className="t-caption">{pluralize(row.count, 'completion')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Habit consistency table
// ---------------------------------------------------------------------------

function HabitSection({ analytics }: { analytics: AnalyticsResult }) {
  return (
    <section className="section" aria-labelledby="habits-heading">
      <div className="section__head">
        <h2 id="habits-heading" className="t-h2">Habit consistency</h2>
      </div>
      <div className="card insights-card">
        {analytics.habits.length === 0 ? (
          <EmptyState
            title="No active habits"
            description="Add a habit to an active Plan to track how consistently you show up."
          />
        ) : (
          <div className="insights-table-wrap">
            <table className="insights-table insights-table--wide">
              <caption>
                Scheduled days completed in the last {analytics.rangeDays} days (lowest consistency first).
              </caption>
              <thead>
                <tr>
                  <th scope="col">Habit</th>
                  <th scope="col" className="num">Done / scheduled</th>
                  <th scope="col" className="num">Rate</th>
                  <th scope="col" className="num">Current streak</th>
                  <th scope="col" className="num">Best streak</th>
                </tr>
              </thead>
              <tbody>
                {analytics.habits.map((h) => (
                  <tr key={h.item.id}>
                    <th scope="row" style={{ fontWeight: 400 }}>
                      <Link to={`/plans/${h.plan.id}`} className="insights-list__title" style={{ color: 'var(--text-primary)' }}>
                        {itemDisplayName(h.item)}
                      </Link>
                      <span className="insights-list__meta">
                        <span className="insights-dot" style={dotStyle(h.track.color)} aria-hidden="true" />
                        {h.track.name}
                      </span>
                    </th>
                    <td className="num">
                      {h.adherence.expected === 0
                        ? 'Not due yet'
                        : `${h.adherence.completed} / ${h.adherence.expected}${h.adherence.unit === 'months' ? ' mo' : ''}`}
                    </td>
                    <td className="num">{h.adherence.rate === null ? '—' : `${h.adherence.rate}%`}</td>
                    <td className="num">{pluralize(h.currentStreak, 'day')}</td>
                    <td className="num">{pluralize(h.longestStreak, 'day')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Day-of-week distribution (horizontal bars, values always visible)
// ---------------------------------------------------------------------------

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function DayOfWeekSection({ analytics }: { analytics: AnalyticsResult }) {
  const max = analytics.dayOfWeek.reduce((m, d) => Math.max(m, d.count), 0)
  return (
    <section className="section" aria-labelledby="dow-heading">
      <div className="section__head">
        <h2 id="dow-heading" className="t-h2">By day of week</h2>
      </div>
      <div className="card insights-card">
        {max === 0 ? (
          <p className="insights-caption">No completions in this range yet, so there is no weekly rhythm to show.</p>
        ) : (
          <>
            <p className="insights-caption">Which days your {pluralize(analytics.totals.completions, 'completion')} landed on.</p>
            <ul className="insights-hbars">
              {analytics.dayOfWeek.map((d) => (
                <li key={d.dayOfWeek} className="insights-hbar">
                  <span className="insights-hbar__label" aria-hidden="true">{d.label}</span>
                  <span className="insights-hbar__track" aria-hidden="true">
                    <span
                      className={`insights-hbar__fill${d.count === max ? ' insights-hbar__fill--peak' : ''}`}
                      style={{ display: 'block', width: `${(d.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="insights-hbar__value" aria-hidden="true">{d.count}</span>
                  <span className="sr-only">{`${WEEKDAY_FULL[d.dayOfWeek]}: ${pluralize(d.count, 'completion')}`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Overdue + recent
// ---------------------------------------------------------------------------

function OverdueSection({ analytics }: { analytics: AnalyticsResult }) {
  return (
    <section className="section" aria-labelledby="overdue-heading">
      <div className="section__head">
        <h2 id="overdue-heading" className="t-h2">Overdue items</h2>
        {analytics.overdue.length > 0 && (
          <Link to="/reviews" className="t-caption">
            Clean up in Weekly review <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="card insights-card">
        {analytics.overdue.length === 0 ? (
          <p className="insights-caption">Nothing overdue in your active Plans.</p>
        ) : (
          <ul className="insights-list">
            {analytics.overdue.map(({ item, plan, track, daysOverdue }) => (
              <li key={item.id} className="insights-list__item">
                <div className="insights-list__main">
                  <span className="insights-list__title">{itemDisplayName(item)}</span>
                  <span className="insights-list__meta">
                    <span className="insights-dot" style={dotStyle(track.color)} aria-hidden="true" />
                    <span>{track.name} · {plan.name}</span>
                    <span>· Due {formatLocalDate(item.due_date ?? '')} ({pluralize(daysOverdue, 'day')} overdue)</span>
                    <Badge>{item.priority}</Badge>
                  </span>
                </div>
                <Link to={`/plans/${plan.id}`} className="insights-link">
                  Open plan<span className="sr-only"> for {itemDisplayName(item)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function RecentSection({ analytics }: { analytics: AnalyticsResult }) {
  return (
    <section className="section" aria-labelledby="recent-heading">
      <div className="section__head">
        <h2 id="recent-heading" className="t-h2">Recent completions</h2>
      </div>
      <div className="card insights-card">
        {analytics.recent.length === 0 ? (
          <p className="insights-caption">No completions in the last {analytics.rangeDays} days.</p>
        ) : (
          <ul className="insights-list">
            {analytics.recent.map((r) => (
              <li key={`${r.itemId}-${r.date}`} className="insights-list__item">
                <div className="insights-list__main">
                  <span className="insights-list__title">{r.itemName}</span>
                  <span className="insights-list__meta">
                    {r.trackName && (
                      <>
                        <span className="insights-dot" style={dotStyle(r.trackColor)} aria-hidden="true" />
                        <span>{r.trackName}</span>
                      </>
                    )}
                    {r.itemType && <Badge>{TYPE_LABELS[r.itemType] ?? r.itemType}</Badge>}
                    {r.isArchivedContext && <Badge>{r.itemType ? 'Archived' : 'Deleted'}</Badge>}
                  </span>
                </div>
                <span className="t-caption">
                  {formatLocalDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

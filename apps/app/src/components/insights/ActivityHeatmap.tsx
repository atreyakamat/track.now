import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import type { ExecutionItem, Track } from '@tracknow/core/types/domain'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import { HEATMAP_RANGES, buildActivityHeatmap, countByDate, type HeatCell } from '@tracknow/core/domain/heatmap'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDaysTo } from '@tracknow/core/domain/schedule'
import { pluralize } from '@tracknow/core/utils/format'
import { Badge } from '@/components/ui'

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * The activity heatmap: a year of days at a glance, one square per day, darker for more done.
 * Click (or arrow to) a day to see exactly what was completed. Filter by Track, switch the
 * span, and optionally ring the period being reviewed. Loads its own year of completions.
 */
export function ActivityHeatmap({
  userId,
  items,
  tracks,
  highlight,
  now,
  idPrefix = 'heatmap',
}: {
  userId: string
  items: ExecutionItem[]
  tracks: Track[]
  /** Ring these days (the week or month under review). */
  highlight?: { start: string; end: string } | null
  now?: Date
  idPrefix?: string
}) {
  const [rows, setRows] = useState<CompletionRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<number>(26)
  const [trackId, setTrackId] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<HeatCell | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchor = useMemo(() => now ?? new Date(), [now])
  const today = getTodayDateString(anchor)

  useEffect(() => {
    let alive = true
    setError(null)
    listCompletionHistory(userId, addDaysTo(today, -372), today)
      .then((r) => alive && setRows(r))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load your activity.'))
    return () => {
      alive = false
    }
  }, [userId, today])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const activeTracks = useMemo(() => tracks.filter((t) => t.status !== 'archived'), [tracks])
  const filtered = useMemo(() => {
    if (!rows) return []
    if (!trackId) return rows
    return rows.filter((c) => itemById.get(c.item_id)?.track_id === trackId)
  }, [rows, trackId, itemById])
  const map = useMemo(() => buildActivityHeatmap({ counts: countByDate(filtered), now: anchor, weeks, highlight }), [filtered, anchor, weeks, highlight])

  // Squares grow to fill the card (11–24px). When the span is too long to fit, the grid scrolls
  // sideways and stays pinned to the most recent weeks, also after a resize.
  const [cell, setCell] = useState(14)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const fit = () => {
      const gap = 3
      const available = el.clientWidth - 44 // weekday labels + breathing room
      setCell(Math.max(11, Math.min(24, Math.floor(available / weeks) - gap)))
      requestAnimationFrame(() => {
        if (el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
      })
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [weeks, rows])

  const dayItems = useMemo(() => {
    if (!selected) return []
    return filtered
      .filter((c) => c.completed_date === selected)
      .map((c) => itemById.get(c.item_id))
      .filter((i): i is ExecutionItem => Boolean(i))
  }, [filtered, selected, itemById])
  const selectedCount = selected ? filtered.filter((c) => c.completed_date === selected).length : 0

  const describe = (cell: HeatCell) => `${shortDate(cell.date)}: ${cell.count === 0 ? 'nothing completed' : pluralize(cell.count, 'completion')}${cell.isToday ? ' (today)' : ''}`

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? 7 : e.key === 'ArrowLeft' ? -7 : e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const base = selected ?? today
    let next = addDaysTo(base, delta)
    if (next > today) next = today
    if (next < map.start) next = map.start
    setSelected(next)
    scrollRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus()
  }

  const headingId = `${idPrefix}-heading`
  const focusable = selected ?? today

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section__head">
        <h2 id={headingId} className="t-h2">
          Activity
        </h2>
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {activeTracks.length > 1 && (
            <label className="heat-filter">
              <span className="sr-only">Show activity for</span>
              <select className="control" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
                <option value="">All Tracks</option>
                {activeTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="insights-range" role="radiogroup" aria-label="Span">
            {HEATMAP_RANGES.map((r) => (
              <button key={r.weeks} type="button" role="radio" aria-checked={weeks === r.weeks} className="insights-range__opt" onClick={() => setWeeks(r.weeks)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card heat">
        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}
        {!error && !rows && <p className="t-meta">Loading your activity…</p>}
        {!error && rows && (
          <>
            <dl className="heat-stats">
              <div>
                <dt>Completions</dt>
                <dd>{map.total}</dd>
              </div>
              <div>
                <dt>Active days</dt>
                <dd>{map.activeDays}</dd>
              </div>
              <div>
                <dt>Current run</dt>
                <dd>
                  {map.currentStreak > 0 && <Flame size={16} aria-hidden="true" className="heat-stats__flame" />}
                  {pluralize(map.currentStreak, 'day')}
                </dd>
              </div>
              <div>
                <dt>Longest run</dt>
                <dd>{pluralize(map.longestStreak, 'day')}</dd>
              </div>
              <div>
                <dt>Best day</dt>
                <dd>{map.bestDay ? `${map.bestDay.count} · ${shortDate(map.bestDay.date)}` : '—'}</dd>
              </div>
            </dl>

            <p className="sr-only">
              {`${map.total} completions on ${map.activeDays} active days between ${longDate(map.start)} and ${longDate(today)}. Use the arrow keys to move between days and Enter to see what was completed.`}
            </p>

            <div className="heat-scroll" ref={scrollRef}>
              <div className="heat-grid" role="grid" aria-label="Completions per day" onKeyDown={onKeyDown} style={{ '--heat-cell': `${cell}px` } as CSSProperties}>
                <div className="heat-days" aria-hidden="true">
                  <span className="heat-month" />
                  {DAY_LABELS.map((l, i) => (
                    <span key={i} className="heat-daylabel">
                      {l}
                    </span>
                  ))}
                </div>
                {map.weeks.map((week, wi) => (
                  <div key={week.start} className="heat-week" role="row" style={{ '--i': wi } as CSSProperties}>
                    <span className="heat-month" aria-hidden="true">
                      {map.months.find((m) => m.weekIndex === wi)?.label ?? ''}
                    </span>
                    {week.days.map((cell) =>
                      cell.isFuture ? (
                        <span key={cell.date} className="heat-cell heat-cell--future" role="gridcell" aria-hidden="true" />
                      ) : (
                        <button
                          key={cell.date}
                          type="button"
                          role="gridcell"
                          data-date={cell.date}
                          data-level={cell.level}
                          className={`heat-cell${cell.isToday ? ' heat-cell--today' : ''}${cell.inRange ? ' heat-cell--range' : ''}${selected === cell.date ? ' heat-cell--selected' : ''}`}
                          tabIndex={cell.date === focusable ? 0 : -1}
                          aria-label={`${longDate(cell.date)}: ${cell.count === 0 ? 'nothing completed' : pluralize(cell.count, 'completion')}`}
                          aria-selected={selected === cell.date}
                          title={describe(cell)}
                          onClick={() => setSelected(selected === cell.date ? null : cell.date)}
                          onMouseEnter={() => setHovered(cell)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(cell)}
                          onBlur={() => setHovered(null)}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="heat-foot">
              <span className="t-caption" aria-live="polite">
                {hovered ? describe(hovered) : highlight ? `Ringed: ${shortDate(highlight.start)} – ${shortDate(highlight.end)}. Click a day to see what you did.` : 'Click a day to see what you did.'}
              </span>
              <span className="heat-legend" aria-hidden="true">
                Less
                {[0, 1, 2, 3, 4].map((l) => (
                  <span key={l} className="heat-cell heat-cell--legend" data-level={l} />
                ))}
                More
              </span>
            </div>

            {selected && (
              <div className="heat-day fade-up" role="region" aria-label={`Completed on ${longDate(selected)}`}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <h3 className="t-h3">{longDate(selected)}</h3>
                  <span className="t-meta">{selectedCount === 0 ? 'Nothing completed' : pluralize(selectedCount, 'completion')}</span>
                </div>
                {dayItems.length > 0 && (
                  <ul className="heat-day__list">
                    {dayItems.map((i, n) => (
                      <li key={`${i.id}-${n}`}>
                        <Badge>{i.type}</Badge>
                        <Link to={`/plans/${i.plan_id}`}>{i.name}</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCount > dayItems.length && <p className="t-caption">{pluralize(selectedCount - dayItems.length, 'completion')} from items that were later deleted.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { listExecutionItems, editExecutionItem } from '@tracknow/core/services/executionService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDaysTo, hasStarted, isFixedScheduleDay, weekStartOf, weeklyTarget } from '@tracknow/core/domain/schedule'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { usePreferences } from '@/hooks/usePreferences'
import { Badge, Button, ErrorState, LoadingState, PageHeader, Tabs, TabPanel } from '@/components/ui'

type View = 'week' | 'month'
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, opts)

/**
 * Calendar: dated items by day, scheduled habits on their days, and a "Plan my week" view with
 * one-tap reschedule (tomorrow, next week, pick a date). Nothing here is a second source of
 * truth: it reads the same items and writes only due dates.
 */
export function CalendarPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { terms } = usePreferences()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(getTodayDateString())
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [completions, setCompletions] = useState<CompletionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = getTodayDateString()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [its, pls, comps] = await Promise.all([listExecutionItems(), listPlans(), listCompletionHistory(user.id, addDaysTo(today, -60), addDaysTo(today, 1))])
      setItems(its)
      setPlans(pls)
      setCompletions(comps)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }, [user, today])

  useEffect(() => {
    void load()
  }, [load])

  const activePlanIds = useMemo(() => new Set(plans.filter((p) => p.status === 'active').map((p) => p.id)), [plans])
  const planName = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans])
  const doneOn = useMemo(() => {
    const s = new Set<string>()
    completions.forEach((c) => s.add(`${c.item_id}|${c.completed_date}`))
    return s
  }, [completions])
  const live = useMemo(() => items.filter((i) => i.status !== 'archived' && activePlanIds.has(i.plan_id)), [items, activePlanIds])

  /** Items that belong on a given day: dated items due that day, habits scheduled that day. */
  const itemsOn = useCallback(
    (date: string) =>
      live.filter((i) => {
        if (!hasStarted(i, date)) return false
        if (i.type === 'habit') return weeklyTarget(i.schedule) === null && isFixedScheduleDay(i.schedule, date)
        return i.due_date === date && (i.status !== 'done' || doneOn.has(`${i.id}|${date}`) || date >= today)
      }),
    [live, doneOn, today],
  )

  const reschedule = async (item: ExecutionItem, due: string) => {
    if (!user) return
    try {
      const updated = await editExecutionItem(item.id, { due_date: due }, user.id)
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      showToast({ id: `resched-${item.id}`, title: `Moved to ${fmtDay(due)}`, message: item.name, type: 'info' })
    } catch (err) {
      showToast({ title: 'Could not move the item', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    }
  }

  const weekStart = weekStartOf(anchor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysTo(weekStart, i))
  const monthFirst = `${anchor.slice(0, 7)}-01`
  const gridStart = weekStartOf(monthFirst)
  const monthCells = Array.from({ length: 42 }, (_, i) => addDaysTo(gridStart, i))
  const monthLabel = new Date(`${monthFirst}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shiftMonth = (n: number) => {
    const [y, m] = anchor.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  return (
    <div>
      <PageHeader title="Calendar" description={`Dated items and scheduled habits across every ${terms.track.toLowerCase()}. Move tasks with one tap; habits follow their schedule.`} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <Tabs
          label="Calendar view"
          tabs={[
            { id: 'week', label: 'Plan my week' },
            { id: 'month', label: 'Month' },
          ]}
          active={view}
          onChange={(id) => setView(id as View)}
        />
        <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => (view === 'week' ? setAnchor(addDaysTo(weekStart, -7)) : shiftMonth(-1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="t-caption" style={{ minWidth: 150, textAlign: 'center' }}>
            {view === 'week' ? `${fmtDay(weekStart)} – ${fmtDay(addDaysTo(weekStart, 6))}` : monthLabel}
          </span>
          <Button variant="ghost" size="sm" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => (view === 'week' ? setAnchor(addDaysTo(weekStart, 7)) : shiftMonth(1))}>
            <ChevronRight size={16} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
        </div>
      </div>

      {loading && <LoadingState label="Loading your calendar…" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <>
          <TabPanel id="week" active={view}>
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              {weekDays.map((date) => {
                const list = itemsOn(date)
                const isToday = date === today
                return (
                  <section key={date} className={`card cal-day${isToday ? ' cal-day--today' : ''}${date < today ? ' cal-day--past' : ''}`} aria-label={fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h2 className="t-h3">
                        {DOW[(new Date(`${date}T00:00:00`).getDay() + 6) % 7]} {fmtDay(date)}
                        {isToday && <Badge accent>Today</Badge>}
                      </h2>
                      <span className="t-meta">{list.length ? `${list.length} planned` : 'Nothing planned'}</span>
                    </div>
                    {list.length > 0 && (
                      <ul className="cal-list">
                        {list.map((i) => {
                          const done = doneOn.has(`${i.id}|${date}`) || (i.type !== 'habit' && i.status === 'done')
                          return (
                            <li key={i.id} className={`cal-item${done ? ' cal-item--done' : ''}`}>
                              <span className="cal-item__main">
                                <Badge>{i.type}</Badge>
                                <Link to={`/plans/${i.plan_id}`} className="cal-item__name">
                                  {i.name}
                                </Link>
                                <span className="t-meta">{planName.get(i.plan_id)}</span>
                              </span>
                              {i.type !== 'habit' && !done && (
                                <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                                  <Button size="sm" variant="ghost" onClick={() => void reschedule(i, addDaysTo(date, 1))}>
                                    +1 day
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => void reschedule(i, addDaysTo(date, 7))}>
                                    Next week
                                  </Button>
                                  <label className="cal-pick">
                                    <span className="sr-only">Pick a date for {i.name}</span>
                                    <input type="date" className="control" value={i.due_date ?? ''} onChange={(e) => e.target.value && void reschedule(i, e.target.value)} />
                                  </label>
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </TabPanel>

          <TabPanel id="month" active={view}>
            <div className="cal-month" role="grid" aria-label={monthLabel}>
              {DOW.map((d) => (
                <div key={d} className="cal-month__dow" role="columnheader">
                  {d}
                </div>
              ))}
              {monthCells.map((date) => {
                const inMonth = date.slice(0, 7) === anchor.slice(0, 7)
                const list = itemsOn(date)
                const doneCount = list.filter((i) => doneOn.has(`${i.id}|${date}`) || (i.type !== 'habit' && i.status === 'done')).length
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    className={`cal-month__cell${inMonth ? '' : ' cal-month__cell--out'}${date === today ? ' cal-month__cell--today' : ''}`}
                    onClick={() => {
                      setAnchor(date)
                      setView('week')
                    }}
                    aria-label={`${fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length} planned, ${doneCount} done`}
                  >
                    <span className="cal-month__num">{Number(date.slice(8, 10))}</span>
                    {list.length > 0 && (
                      <span className="cal-month__dots" aria-hidden="true">
                        {list.slice(0, 4).map((i) => (
                          <span key={i.id} className={`cal-month__dot${doneOn.has(`${i.id}|${date}`) || (i.type !== 'habit' && i.status === 'done') ? ' cal-month__dot--done' : ''}`} />
                        ))}
                        {list.length > 4 && <span className="t-meta">+{list.length - 4}</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </TabPanel>
        </>
      )}
    </div>
  )
}

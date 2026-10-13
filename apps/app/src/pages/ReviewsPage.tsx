import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardCheck, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { listTracks } from '@/services/tracksService'
import { listPlans } from '@/services/plansService'
import {
  listCompletionsForDate,
  listExecutionItems,
  setItemDone,
  updateExecutionItem,
} from '@/services/executionService'
import {
  settleRemindersAfterCompletion,
  cancelReminderForItem,
  rescheduleReminderForItem,
} from '@/services/reminderService'
import { listCompletionHistory, type CompletionRecord } from '@/services/historyService'
import {
  loadReviewNote,
  saveReviewNote,
  deleteReviewNote,
  MAX_ANSWER_LENGTH,
  MAX_PRIORITIES,
  MAX_PRIORITY_LENGTH,
  type ReviewNoteKind,
} from '@/services/reviewNotesStorage'
import { getTodayDateString } from '@/domain/dates'
import { formatDateRangeLabel, formatLocalDate, itemDisplayName, type DateRange, type OverdueItem } from '@/domain/analytics'
import {
  buildReviewSummary,
  getMonthRange,
  getWeekRange,
  makePeriodKey,
  type ReviewSummary,
} from '@/domain/reviews'
import type { ExecutionItem, ItemType, Plan, Track } from '@/types/domain'
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  ProgressBar,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui'
import { pluralize } from '@/utils/format'
import '@/styles/insights.css'

interface Prompt {
  id: string
  label: string
  hint?: string
}

const WEEKLY_PROMPTS: Prompt[] = [
  { id: 'moved_forward', label: 'What moved forward this week?' },
  { id: 'friction', label: 'Where did friction show up?' },
  { id: 'differently', label: 'What will you do differently next week?' },
]

const MONTHLY_PROMPTS: Prompt[] = [
  { id: 'progress', label: 'Which Tracks made real progress this month?' },
  { id: 'stalled', label: 'What stalled, and why?' },
  { id: 'next_month', label: 'What deserves your focus next month?' },
]

const TABS = [
  { id: 'weekly', label: 'Weekly review' },
  { id: 'monthly', label: 'Monthly reflection' },
]

const TYPE_LABELS: Record<ItemType, string> = {
  habit: 'Habit', task: 'Task', checklist: 'Checklist', milestone: 'Milestone', project: 'Project',
}
const LOCAL_ONLY_NOTICE = 'Saved on this device only — review notes are not synced to your account or other devices.'

const dotStyle = (color: string | null | undefined): CSSProperties | undefined =>
  color ? ({ '--dot-color': color } as CSSProperties) : undefined

interface LoadedData {
  tracks: Track[]
  plans: Plan[]
  items: ExecutionItem[]
  completions: CompletionRecord[]
  loadedAt: Date
  rangeKey: string
}

interface FormState {
  answers: Record<string, string>
  priorities: string[]
}

type PendingNav = { kind: 'tab'; tab: ReviewNoteKind } | { kind: 'offset'; delta: number }

const emptyPriorities = (): string[] => Array.from({ length: MAX_PRIORITIES }, () => '')

/** Canonical form used to detect unsaved changes (ignores blank answers / empty slots). */
function normalizeForm(form: FormState): string {
  const answers = Object.fromEntries(
    Object.entries(form.answers).filter(([, v]) => v.trim() !== '').sort(([a], [b]) => a.localeCompare(b)),
  )
  const priorities = form.priorities.map((p) => p.trim()).filter(Boolean)
  return JSON.stringify({ answers, priorities })
}

function periodEyebrow(kind: ReviewNoteKind, offset: number): string {
  if (kind === 'weekly') {
    if (offset === 0) return 'This week'
    if (offset === -1) return 'Last week'
    return `${-offset} weeks ago`
  }
  if (offset === 0) return 'This month'
  if (offset === -1) return 'Last month'
  return `${-offset} months ago`
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ReviewsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { showToast } = useToast()
  const [anchorNow] = useState(() => new Date())
  const [tab, setTab] = useState<ReviewNoteKind>('weekly')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const offset = tab === 'weekly' ? weekOffset : monthOffset

  const range: DateRange = useMemo(
    () => (tab === 'weekly' ? getWeekRange(anchorNow, weekOffset) : getMonthRange(anchorNow, monthOffset)),
    [tab, weekOffset, monthOffset, anchorNow],
  )
  const periodKey = makePeriodKey(tab, range)
  const rangeKey = `${range.start}|${range.end}`

  // ---------------- Data ----------------
  const [data, setData] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!userId) {
      setLoading(false)
      setError('Sign in to run your reviews.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const today = getTodayDateString(now)
      const [start, end] = rangeKey.split('|')
      const historyEnd = end < today ? end : today
      const [tracks, plans, items, periodCompletions, todayIds] = await Promise.all([
        listTracks(),
        listPlans(),
        listExecutionItems(),
        start <= historyEnd ? listCompletionHistory(userId, start, historyEnd) : Promise.resolve([] as CompletionRecord[]),
        listCompletionsForDate(userId, today),
      ])
      if (requestId !== requestRef.current) return
      // Today's completions feed the current progress snapshot even when reviewing a past period.
      const completions: CompletionRecord[] = [
        ...periodCompletions,
        ...todayIds.map((itemId) => ({ item_id: itemId, completed_date: today, completed_at: null })),
      ]
      setData({ tracks, plans, items, completions, loadedAt: now, rangeKey })
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load review data.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, rangeKey])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo<ReviewSummary | null>(
    () =>
      data && data.rangeKey === rangeKey
        ? buildReviewSummary({
            tracks: data.tracks,
            plans: data.plans,
            items: data.items,
            completions: data.completions,
            range,
            now: data.loadedAt,
          })
        : null,
    [data, range, rangeKey],
  )

  // ---------------- Notes (device-local) ----------------
  const [form, setForm] = useState<FormState>({ answers: {}, priorities: emptyPriorities() })
  const [savedSnapshot, setSavedSnapshot] = useState(() => normalizeForm({ answers: {}, priorities: [] }))
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null)
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null)

  useEffect(() => {
    const note = userId ? loadReviewNote(userId, periodKey) : null
    const priorities = emptyPriorities()
    note?.priorities.forEach((p, i) => {
      if (i < MAX_PRIORITIES) priorities[i] = p
    })
    const next: FormState = { answers: { ...(note?.answers ?? {}) }, priorities }
    setForm(next)
    setSavedSnapshot(normalizeForm(next))
    setSavedAt(note?.updatedAt ?? null)
    setSaveStatus(null)
  }, [userId, periodKey])

  const dirty = normalizeForm(form) !== savedSnapshot

  // Unsaved notes must survive in-app navigation (sidebar links unmount this page without a
  // beforeunload event): autosave shortly after typing stops, and on unmount.
  const latestNoteRef = useRef({ userId, periodKey, tab, form, dirty })
  latestNoteRef.current = { userId, periodKey, tab, form, dirty }
  const persistDraft = useCallback(() => {
    const cur = latestNoteRef.current
    if (!cur.userId || !cur.dirty) return false
    return saveReviewNote(cur.userId, {
      periodKey: cur.periodKey,
      kind: cur.tab,
      answers: Object.fromEntries(Object.entries(cur.form.answers).filter(([, v]) => v.trim() !== '')),
      priorities: cur.form.priorities.map((p) => p.trim()).filter(Boolean),
    })
  }, [])
  useEffect(() => () => void persistDraft(), [persistDraft])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const save = (): boolean => {
    if (!userId) return false
    const ok = saveReviewNote(userId, {
      periodKey,
      kind: tab,
      answers: Object.fromEntries(Object.entries(form.answers).filter(([, v]) => v.trim() !== '')),
      priorities: form.priorities.map((p) => p.trim()).filter(Boolean),
    })
    if (!ok) {
      setSaveStatus({
        type: 'error',
        message: 'Could not save on this device — browser storage may be full or disabled. Copy your notes somewhere safe before leaving.',
      })
      return false
    }
    const stored = loadReviewNote(userId, periodKey)
    setSavedSnapshot(normalizeForm(form))
    setSavedAt(stored?.updatedAt ?? new Date().toISOString())
    setSaveStatus({ type: 'ok', message: 'Review saved on this device.' })
    return true
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const removeSavedNote = () => {
    if (!userId) return
    deleteReviewNote(userId, periodKey)
    const cleared: FormState = { answers: {}, priorities: emptyPriorities() }
    setForm(cleared)
    setSavedSnapshot(normalizeForm(cleared))
    setSavedAt(null)
    setConfirmDelete(false)
    setSaveStatus({ type: 'ok', message: 'Saved notes for this period were deleted from this device.' })
  }

  const applyNav = (nav: PendingNav) => {
    if (nav.kind === 'tab') {
      setTab(nav.tab)
    } else if (tab === 'weekly') {
      setWeekOffset((o) => Math.min(0, o + nav.delta))
    } else {
      setMonthOffset((o) => Math.min(0, o + nav.delta))
    }
  }

  const requestNav = (nav: PendingNav) => {
    if (dirty) {
      setPendingNav(nav)
      return
    }
    applyNav(nav)
  }

  const resolvePending = (choice: 'save' | 'discard' | 'cancel') => {
    const nav = pendingNav
    setPendingNav(null)
    if (!nav || choice === 'cancel') return
    if (choice === 'save' && !save()) return
    applyNav(nav)
  }

  // ---------------- Overdue actions ----------------
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set())
  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })

  const markDone = async (item: ExecutionItem) => {
    if (!userId || busyIds.has(item.id)) return
    setBusy(item.id, true)
    try {
      // Idempotent: an item already completed elsewhere stays done (never flipped back).
      const updated = await setItemDone(item.id, true, userId)
      settleRemindersAfterCompletion(userId, updated)
      showToast({ title: 'Marked done', message: itemDisplayName(item), type: 'success' })
      await load()
    } catch (err) {
      showToast({
        title: 'Could not mark as done',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
    } finally {
      setBusy(item.id, false)
    }
  }

  const reschedule = async (item: ExecutionItem, dueDate: string): Promise<boolean> => {
    if (busyIds.has(item.id)) return false
    setBusy(item.id, true)
    try {
      const updated = await updateExecutionItem(item.id, { due_date: dueDate })
      showToast({ title: 'Rescheduled', message: `${itemDisplayName(item)} → ${formatLocalDate(dueDate)}`, type: 'success' })
      if (userId) {
        // A reminder relative to the old due date must follow the new one.
        try {
          rescheduleReminderForItem(userId, updated)
        } catch (reminderErr) {
          cancelReminderForItem(userId, updated.id)
          showToast({
            title: 'Reminder removed',
            message:
              reminderErr instanceof Error
                ? `${reminderErr.message} Set a new reminder from the item if you still need one.`
                : 'The reminder could not follow the new date.',
            type: 'warning',
          })
        }
      }
      await load()
      return true
    } catch (err) {
      showToast({
        title: 'Could not reschedule',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
      return false
    } finally {
      setBusy(item.id, false)
    }
  }

  // ---------------- Render ----------------
  const prompts = tab === 'weekly' ? WEEKLY_PROMPTS : MONTHLY_PROMPTS
  const unit = tab === 'weekly' ? 'week' : 'month'
  const periodTitle =
    tab === 'weekly'
      ? formatDateRangeLabel(range)
      : formatLocalDate(range.start, { month: 'long', year: 'numeric' })
  const isEmptyAccount = data !== null && data.tracks.length === 0 && data.items.length === 0

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="A short, honest look back — built from what you actually completed — and a clear choice of what comes next."
      />

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(id) => {
          if (id !== tab) requestNav({ kind: 'tab', tab: id as ReviewNoteKind })
        }}
        label="Review type"
      />

      <TabPanel id={tab} active={tab}>
        <div className="insights" style={{ marginTop: 'var(--space-4)' }}>
          <div className="insights-period">
            <div className="insights-period__label">
              <span className="t-meta">{periodEyebrow(tab, offset)}</span>
              <h2 className="t-h2" aria-live="polite">{periodTitle}</h2>
            </div>
            <div className="insights-period__nav">
              <Button size="sm" onClick={() => requestNav({ kind: 'offset', delta: -1 })}>
                <ChevronLeft size={16} aria-hidden="true" /> Previous {unit}
              </Button>
              <Button size="sm" onClick={() => requestNav({ kind: 'offset', delta: 1 })} disabled={offset >= 0}>
                Next {unit} <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {pendingNav && (
            <div className="alert alert--info insights-confirm" role="alert">
              <strong>You have unsaved review notes</strong>
              <span>Save them before leaving this {unit}, or discard the changes.</span>
              <div className="insights-confirm__actions">
                <Button size="sm" variant="primary" onClick={() => resolvePending('save')}>Save and continue</Button>
                <Button size="sm" onClick={() => resolvePending('discard')}>Discard changes</Button>
                <Button size="sm" variant="ghost" onClick={() => resolvePending('cancel')}>Keep editing</Button>
              </div>
            </div>
          )}

          {loading && !summary && <LoadingState label="Loading your review…" />}
          {error && <ErrorState title="Could not load this review" message={error} onRetry={() => void load()} />}

          {!error && summary && isEmptyAccount && (
            <EmptyState
              icon={<ClipboardCheck size={20} />}
              title="Nothing to review yet"
              description="Reviews summarize your real Tracks, habits and tasks. Create a Track and start executing — your first review will fill in from there. You can still jot reflections below."
              action={
                <ButtonLink to="/tracks/new" variant="primary">
                  <Plus size={16} aria-hidden="true" /> Create a Track
                </ButtonLink>
              }
            />
          )}

          {!error && summary && !isEmptyAccount && (
            <div className="insights" aria-busy={loading} style={loading ? { opacity: 0.6 } : undefined}>
              {tab === 'weekly' ? (
                <>
                  <OverdueCleanup overdue={summary.overdue} busyIds={busyIds} onMarkDone={markDone} onReschedule={reschedule} now={anchorNow} />
                  <HabitWeek summary={summary} />
                  <Wins summary={summary} unit={unit} />
                </>
              ) : (
                <>
                  <TrackSnapshot summary={summary} />
                  <Milestones summary={summary} />
                  <ArchiveCandidates summary={summary} />
                </>
              )}
            </div>
          )}

          {userId && (
            <section className="section" aria-labelledby="reflect-heading">
              <div className="section__head">
                <h2 id="reflect-heading" className="t-h2">Reflection</h2>
              </div>
              <div className="card insights-card">
                <div className="insights-prompts">
                  {prompts.map((prompt) => (
                    <Textarea
                      key={prompt.id}
                      label={prompt.label}
                      hint={prompt.hint}
                      maxLength={MAX_ANSWER_LENGTH}
                      value={form.answers[prompt.id] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setForm((f) => ({ ...f, answers: { ...f.answers, [prompt.id]: value } }))
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {userId && tab === 'weekly' && (
            <PrioritiesSection
              form={form}
              setForm={setForm}
              candidates={summary?.priorityCandidates ?? []}
            />
          )}

          {userId && (
            <div className="insights-savebar">
              <p className="insights-notice">{LOCAL_ONLY_NOTICE}</p>
              <div className="insights-savebar__row">
                <Button variant="primary" onClick={() => save()} disabled={!dirty}>
                  Save {tab === 'weekly' ? 'weekly review' : 'monthly reflection'}
                </Button>
                {savedAt && !confirmDelete && (
                  <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                    Delete saved notes
                  </Button>
                )}
                {confirmDelete && (
                  <span className="row" style={{ gap: 'var(--space-2)' }}>
                    <span className="t-caption">Delete this period's notes from this device?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                    <Button variant="danger" size="sm" onClick={removeSavedNote}>
                      Delete
                    </Button>
                  </span>
                )}
                <p
                  className={`insights-savebar__status${saveStatus?.type === 'error' ? ' insights-savebar__status--error' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {saveStatus?.type === 'error'
                    ? saveStatus.message
                    : dirty
                      ? 'Unsaved changes.'
                      : savedAt
                        ? `Last saved ${formatSavedAt(savedAt)}.`
                        : 'Not saved yet.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </TabPanel>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly sections
// ---------------------------------------------------------------------------

function OverdueCleanup({
  overdue, busyIds, onMarkDone, onReschedule, now,
}: {
  overdue: OverdueItem[]
  busyIds: ReadonlySet<string>
  onMarkDone: (item: ExecutionItem) => Promise<void>
  onReschedule: (item: ExecutionItem, dueDate: string) => Promise<boolean>
  now: Date
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dateValue, setDateValue] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const today = getTodayDateString(now)

  const startEditing = (item: ExecutionItem) => {
    setEditingId(item.id)
    setDateValue(today)
    setDateError(null)
  }

  const submit = async (item: ExecutionItem) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setDateError('Choose a date.')
      return
    }
    if (dateValue < today) {
      setDateError('Choose today or a later date.')
      return
    }
    if (await onReschedule(item, dateValue)) setEditingId(null)
  }

  return (
    <section className="section" aria-labelledby="overdue-heading">
      <div className="section__head">
        <h2 id="overdue-heading" className="t-h2">1. Overdue cleanup</h2>
        <span className="t-caption">As of today</span>
      </div>
      <div className="card insights-card">
        {overdue.length === 0 ? (
          <p className="insights-caption">Nothing overdue in your active Plans. Nice and clean.</p>
        ) : (
          <ul className="insights-list">
            {overdue.map(({ item, plan, track, daysOverdue }) => {
              const busy = busyIds.has(item.id)
              const name = itemDisplayName(item)
              return (
                <li key={item.id} className="insights-list__item">
                  <div className="insights-list__main">
                    <span className="insights-list__title">{name}</span>
                    <span className="insights-list__meta">
                      <span className="insights-dot" style={dotStyle(track.color)} aria-hidden="true" />
                      <span>{track.name} · {plan.name}</span>
                      <span>· Due {formatLocalDate(item.due_date ?? '')} ({pluralize(daysOverdue, 'day')} overdue)</span>
                      <Badge>{item.priority}</Badge>
                    </span>
                  </div>
                  <div className="insights-list__actions">
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void onMarkDone(item)}>
                      Mark done<span className="sr-only"> {name}</span>
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      aria-expanded={editingId === item.id}
                      onClick={() => (editingId === item.id ? setEditingId(null) : startEditing(item))}
                    >
                      Reschedule<span className="sr-only"> {name}</span>
                    </Button>
                    <Link to={`/plans/${plan.id}`} className="insights-link">
                      Open plan<span className="sr-only"> for {name}</span>
                    </Link>
                  </div>
                  {editingId === item.id && (
                    <form
                      className="insights-reschedule"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void submit(item)
                      }}
                    >
                      <Input
                        type="date"
                        label={`New due date for ${name}`}
                        min={today}
                        value={dateValue}
                        error={dateError}
                        onChange={(event) => {
                          setDateValue(event.target.value)
                          setDateError(null)
                        }}
                        required
                      />
                      <Button size="sm" type="submit" variant="primary" disabled={busy}>
                        {busy ? 'Saving…' : 'Save date'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                        Cancel
                      </Button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function HabitWeek({ summary }: { summary: ReviewSummary }) {
  const { rows, expected, completed, rate } = summary.habits
  return (
    <section className="section" aria-labelledby="habit-week-heading">
      <div className="section__head">
        <h2 id="habit-week-heading" className="t-h2">2. Habit consistency</h2>
        {expected > 0 && (
          <span className="t-caption">
            {completed} of {expected} scheduled days{rate !== null ? ` · ${rate}%` : ''}
          </span>
        )}
      </div>
      <div className="card insights-card">
        {rows.length === 0 ? (
          <p className="insights-caption">No active habits to review this week.</p>
        ) : (
          <>
            <p className="insights-caption">
              Scheduled days {summary.isCurrentPeriod ? 'so far this week' : 'in this week'}; today is not counted as missed until it is over.
            </p>
            <ul className="insights-list">
              {rows.map(({ item, track, adherence }) => (
                <li key={item.id} className="insights-list__item">
                  <div className="insights-list__main">
                    <span className="insights-list__title">{itemDisplayName(item)}</span>
                    <span className="insights-list__meta">
                      <span className="insights-dot" style={dotStyle(track.color)} aria-hidden="true" />
                      {track.name}
                    </span>
                  </div>
                  <span className="t-caption">
                    {adherence.expected === 0
                      ? 'Not due yet'
                      : `${adherence.completed} of ${pluralize(adherence.expected, adherence.unit === 'months' ? 'month' : 'scheduled day')}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

function Wins({ summary, unit }: { summary: ReviewSummary; unit: string }) {
  const typeEntries = Object.entries(summary.winsByType) as Array<[ItemType, number]>
  return (
    <section className="section" aria-labelledby="wins-heading">
      <div className="section__head">
        <h2 id="wins-heading" className="t-h2">3. Wins</h2>
        {typeEntries.length > 0 && (
          <div className="insights-chips">
            {typeEntries.map(([type, count]) => (
              <Badge key={type}>{pluralize(count, TYPE_LABELS[type])}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="card insights-card">
        {summary.wins.length === 0 ? (
          <p className="insights-caption">
            No tasks, checklists, milestones or projects were completed this {unit}
            {summary.totalCompletions > 0 ? ` — but you logged ${pluralize(summary.totalCompletions, 'habit completion')}` : ''}.
          </p>
        ) : (
          <ul className="insights-list">
            {summary.wins.map((win) => (
              <li key={win.item.id} className="insights-list__item">
                <div className="insights-list__main">
                  <span className="insights-list__title">{itemDisplayName(win.item)}</span>
                  <span className="insights-list__meta">
                    {win.track && (
                      <>
                        <span className="insights-dot" style={dotStyle(win.track.color)} aria-hidden="true" />
                        <span>{win.track.name}</span>
                      </>
                    )}
                    <Badge accent={win.item.type === 'milestone'}>{TYPE_LABELS[win.item.type]}</Badge>
                  </span>
                </div>
                <span className="t-caption">{formatLocalDate(win.completedDate, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function PrioritiesSection({
  form, setForm, candidates,
}: {
  form: FormState
  setForm: (updater: (f: FormState) => FormState) => void
  candidates: ReviewSummary['priorityCandidates']
}) {
  const chosen = new Set(form.priorities.map((p) => p.trim().toLowerCase()).filter(Boolean))
  const hasFreeSlot = form.priorities.some((p) => p.trim() === '')
  const setSlot = (index: number, value: string) =>
    setForm((f) => ({ ...f, priorities: f.priorities.map((p, i) => (i === index ? value : p)) }))
  const addCandidate = (name: string) =>
    setForm((f) => {
      const slot = f.priorities.findIndex((p) => p.trim() === '')
      if (slot === -1) return f
      return { ...f, priorities: f.priorities.map((p, i) => (i === slot ? name.slice(0, MAX_PRIORITY_LENGTH) : p)) }
    })
  const shown = candidates.slice(0, 8)

  return (
    <section className="section" aria-labelledby="priorities-heading">
      <div className="section__head">
        <h2 id="priorities-heading" className="t-h2">4. Top 3 priorities for next week</h2>
      </div>
      <div className="card insights-card">
        <div className="insights-priorities">
          {form.priorities.map((value, index) => (
            <Input
              key={index}
              label={`Priority ${index + 1}`}
              maxLength={MAX_PRIORITY_LENGTH}
              value={value}
              onChange={(event) => setSlot(index, event.target.value)}
            />
          ))}
        </div>
        {shown.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <h3 className="t-h3">Quick pick from open items</h3>
            <p className="insights-caption">Ordered by priority, then due date.</p>
            <ul className="insights-quickpick">
              {shown.map(({ item, track }) => {
                const name = itemDisplayName(item)
                const already = chosen.has(name.trim().toLowerCase())
                return (
                  <li key={item.id} className="insights-quickpick__item">
                    <div className="insights-list__main">
                      <span className="insights-list__title">{name}</span>
                      <span className="insights-list__meta">
                        <span className="insights-dot" style={dotStyle(track.color)} aria-hidden="true" />
                        <span>{track.name}</span>
                        <Badge>{item.priority}</Badge>
                        {item.due_date && <span>· Due {formatLocalDate(item.due_date)}</span>}
                      </span>
                    </div>
                    <Button size="sm" disabled={already || !hasFreeSlot} onClick={() => addCandidate(name)}>
                      {already ? 'Added' : 'Add'}
                      <span className="sr-only"> {name} to priorities</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Monthly sections
// ---------------------------------------------------------------------------

function TrackSnapshot({ summary }: { summary: ReviewSummary }) {
  return (
    <section className="section" aria-labelledby="track-snapshot-heading">
      <div className="section__head">
        <h2 id="track-snapshot-heading" className="t-h2">Tracks this month</h2>
        <span className="t-caption">{pluralize(summary.totalCompletions, 'completion')}</span>
      </div>
      <div className="card insights-card">
        <p className="insights-caption">Completions logged this month, with each active Track’s progress as of today.</p>
        {summary.trackCompletions.length === 0 ? (
          <p className="insights-caption">No active Tracks yet.</p>
        ) : (
          <div>
            {summary.trackCompletions.map((row) => (
              <div key={row.trackId ?? 'unknown'} className="insights-track">
                <div className="insights-track__head">
                  {row.trackId && row.isActive ? (
                    <Link to={`/tracks/${row.trackId}`} className="insights-track__name">
                      <span className="insights-dot" style={dotStyle(row.color)} aria-hidden="true" />
                      {row.name}
                    </Link>
                  ) : (
                    <span className="insights-track__name">
                      <span className="insights-dot" style={dotStyle(row.color)} aria-hidden="true" />
                      {row.name}
                      {row.trackId && <Badge>Archived</Badge>}
                    </span>
                  )}
                  <span className="t-caption">{pluralize(row.count, 'completion')}</span>
                </div>
                {row.progress && (
                  <>
                    <ProgressBar percent={row.progress.percent} color={row.color ?? undefined} label={`${row.name} progress`} />
                    <span className="t-caption">
                      {row.progress.total === 0 ? 'No items in active Plans' : `${row.progress.done} of ${row.progress.total} items done`}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Milestones({ summary }: { summary: ReviewSummary }) {
  const otherWins = summary.wins.length - summary.completedMilestones.length
  return (
    <section className="section" aria-labelledby="milestones-heading">
      <div className="section__head">
        <h2 id="milestones-heading" className="t-h2">Completed milestones</h2>
        {otherWins > 0 && <span className="t-caption">+ {pluralize(otherWins, 'other item')} completed</span>}
      </div>
      <div className="card insights-card">
        {summary.completedMilestones.length === 0 ? (
          <p className="insights-caption">No milestones were completed this month.</p>
        ) : (
          <ul className="insights-list">
            {summary.completedMilestones.map((win) => (
              <li key={win.item.id} className="insights-list__item">
                <div className="insights-list__main">
                  <span className="insights-list__title">{itemDisplayName(win.item)}</span>
                  {win.track && (
                    <span className="insights-list__meta">
                      <span className="insights-dot" style={dotStyle(win.track.color)} aria-hidden="true" />
                      <span>{win.track.name}{win.plan ? ` · ${win.plan.name}` : ''}</span>
                    </span>
                  )}
                </div>
                <span className="t-caption">{formatLocalDate(win.completedDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function ArchiveCandidates({ summary }: { summary: ReviewSummary }) {
  return (
    <section className="section" aria-labelledby="archive-heading">
      <div className="section__head">
        <h2 id="archive-heading" className="t-h2">Plans to consider archiving</h2>
      </div>
      <div className="card insights-card">
        <p className="insights-caption">
          Active Plans that have passed their end date or have every item done. Nothing is archived automatically — open a Plan to decide.
        </p>
        {summary.planArchiveCandidates.length === 0 ? (
          <p className="insights-caption">No Plans look finished right now.</p>
        ) : (
          <ul className="insights-list">
            {summary.planArchiveCandidates.map(({ plan, track, progress, reason }) => (
              <li key={plan.id} className="insights-list__item">
                <div className="insights-list__main">
                  <span className="insights-list__title">{plan.name}</span>
                  <span className="insights-list__meta">
                    <span className="insights-dot" style={dotStyle(track.color)} aria-hidden="true" />
                    <span>{track.name}</span>
                    <span>
                      ·{' '}
                      {reason === 'ended'
                        ? `Ended ${formatLocalDate(plan.end_date ?? '')} · ${progress.percent}% done`
                        : `All ${pluralize(progress.total, 'item')} done`}
                    </span>
                  </span>
                </div>
                <Link to={`/plans/${plan.id}`} className="insights-link">
                  Review plan<span className="sr-only"> {plan.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

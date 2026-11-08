import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Layers, Plus, Star } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listTodayWorkspace,
  type TodayWorkspace,
} from '@tracknow/core/services/executionService'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import { getTodayDateString, greeting } from '@tracknow/core/domain/dates'
import { groupTodayItems, MAX_FOCUS, todaySummary } from '@tracknow/core/domain/today'
import { calcMomentum, computeXp, levelFor, MOMENTUM_WINDOW_DAYS } from '@tracknow/core/domain/momentum'
import { activeDayStreak, calcQuests, questXp } from '@tracknow/core/domain/quests'
import { buildRetention } from '@tracknow/core/domain/retention'
import { onboardingState } from '@/features/onboarding/onboardingState'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { QuestCard } from '@/components/onboarding/QuestCard'
import { LevelStrip } from '@/components/insights/LevelStrip'
import { ledgerWithToday, useLifetimeLedger } from '@/hooks/useLifetimeLedger'
import { weeklyTargetStatus } from '@tracknow/core/domain/schedule'
import { loadFocusIds, toggleFocusId } from '@tracknow/core/services/focusService'
import { addSkip, loadSkips, removeSkip, skippedDatesByItem, type SkipReason, SKIP_REASONS } from '@tracknow/core/services/skipService'
import { usePreferences } from '@/hooks/usePreferences'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { groupArcs } from '@tracknow/core/domain/arcs'
import { arcPath } from '@/components/plans/ArcCard'
import { Button, ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { EditItemModal } from '@/components/execution/EditItemModal'
import { CreateItemModal } from '@/components/execution/CreateItemModal'
import { reconcileRemindersWithActiveItems } from '@tracknow/core/services/reminderService'
import { buildWidgetDataPayload, saveWidgetData } from '@/services/widgetDataService'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { addDays } from '@tracknow/core/domain/streaks'

const EMPTY_WORKSPACE: TodayWorkspace = { items: [], plans: [], tracks: [] }

export function TodayPage() {
  const { user, displayName } = useAuth()
  const { showToast } = useToast()
  const userId = user?.id
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [workspace, setWorkspace] = useState<TodayWorkspace>(EMPTY_WORKSPACE)
  const [recent, setRecent] = useState<CompletionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [focusIds, setFocusIds] = useState<string[]>(() => (userId ? loadFocusIds(userId) : []))
  const [loadedDate, setLoadedDate] = useState(getTodayDateString())
  const requestRef = useRef(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tourOpen, setTourOpen] = useState(false)
  const { gentle, terms } = usePreferences()
  const [skips, setSkips] = useState(() => (userId ? loadSkips(userId) : []))
  const [tourDone, setTourDone] = useState(() => (userId ? onboardingState.tourDone(userId) : false))
  const [focusUsed, setFocusUsed] = useState(() => (userId ? onboardingState.focusUsed(userId) : false))
  const [questsDismissed, setQuestsDismissed] = useState(() => (userId ? onboardingState.questsDismissed(userId) : false))
  const { ledger, reload: reloadLedger } = useLifetimeLedger(userId)

  const persistWidget = useCallback(
    (list: ExecutionItem[], completedTodayIds: string[]) => {
      if (!userId) return
      buildWidgetDataPayload(userId, list, { completedTodayIds })
        .then(saveWidgetData)
        .catch(() => undefined)
    },
    [userId],
  )

  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId) return
      const requestId = ++requestRef.current
      try {
        if (!opts.silent) setLoading(true)
        setError(null)
        const today = getTodayDateString()
        const [ws, todayIds, recentRows] = await Promise.all([
          listTodayWorkspace(),
          listCompletionsForDate(userId, today),
          // Momentum only needs the last 14 days of completions (never the whole history).
          listCompletionHistory(userId, addDays(today, -(MOMENTUM_WINDOW_DAYS - 1))).catch(() => [] as CompletionRecord[]),
        ])
        const habitIds = ws.items.filter((i) => i.type === 'habit').map((h) => h.id)
        // Streaks only need roughly the last year of history.
        const history = habitIds.length ? await listCompletionsForItems(habitIds, addDays(today, -400)) : {}
        if (requestId !== requestRef.current) return

        setItems(ws.items)
        setWorkspace(ws)
        setRecent(recentRows)
        actionsRef.current?.setCompletionState(todayIds, history)
        setLoadedDate(today)
        setFocusIds(loadFocusIds(userId))
        if (opts.silent) void reloadLedger()
        // Reminders for items that were deleted elsewhere or whose plan/track is archived.
        reconcileRemindersWithActiveItems(userId, ws.items.map((i) => i.id))
        persistWidget(ws.items, todayIds)
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load today’s items.')
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [userId, persistWidget, reloadLedger],
  )

  const actions = useExecutionItemActions({
    userId,
    items,
    setItems,
    reload: () => loadData({ silent: true }),
    onChanged: ({ items: list, completedTodayIds }) => persistWidget(list, completedTodayIds),
  })
  actionsRef.current = actions

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Midnight rollover: if the page stays open past midnight, reload so habits reset.
  useEffect(() => {
    const check = () => {
      if (getTodayDateString() !== loadedDate) void loadData({ silent: true })
    }
    const id = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [loadedDate, loadData])

  const context = useMemo(() => {
    const trackName = new Map(workspace.tracks.map((t) => [t.id, t.name]))
    const map = new Map<string, { label: string; to: string }>()
    for (const p of workspace.plans) {
      const t = trackName.get(p.track_id)
      map.set(p.id, { label: t ? `${p.name} · ${t}` : p.name, to: `/tracks/${p.track_id}/plans/${p.id}` })
    }
    return map
  }, [workspace])

  // Level, streak, quests and this week's planned work: derived from the lifetime ledger, kept
  // in step with today's toggles so a completion is reflected at once.
  const progress = useMemo(() => {
    // Wait for the page's own data too, or the first level seen would be a phantom level 1.
    if (!ledger || loading) return null
    const today = getTodayDateString()
    const rows = ledgerWithToday(ledger, today, actions.completedTodayIds)
    const plans = workspace.plans as Plan[]
    const quests = calcQuests({
      tracks: workspace.tracks.length,
      plans: plans.length,
      items: items.filter((i) => i.status !== 'archived').length,
      arcPlans: plans.filter((p) => p.arc_name?.trim()).length,
      completions: rows,
      tourDone,
      focusUsed,
    })
    const xp = computeXp(rows, items).total + questXp(quests)
    const week = buildRetention({ items, plans, completions: rows, now: new Date(), weeks: 1, skippedByItem: skippedDatesByItem(skips) }).weeks[0]
    return {
      level: levelFor(xp),
      streak: activeDayStreak(rows, today, addDays(today, -1)),
      quests,
      week: week ? { done: week.done, planned: week.planned } : null,
    }
  }, [ledger, loading, actions.completedTodayIds, items, workspace, tourDone, focusUsed, skips])

  // Announce a level-up once (the last level seen is remembered per user on this device).
  useEffect(() => {
    if (!userId || !progress) return
    const last = onboardingState.lastLevel(userId)
    if (last && progress.level.level > last) {
      showToast({
        id: `level-${progress.level.level}`,
        title: `Level ${progress.level.level}: ${progress.level.name}`,
        message: 'Earned from your completions alone. Keep going.',
        type: 'success',
        duration: 8000,
      })
    }
    if (progress.level.level !== last) onboardingState.setLastLevel(userId, progress.level.level)
  }, [progress, userId, showToast])

  // The tour opens itself once for a brand-new account, or on demand (?tour=1, Settings, quest).
  useEffect(() => {
    if (loading || !userId) return
    if (searchParams.get('tour') === '1') {
      setTourOpen(true)
      setSearchParams((p) => {
        p.delete('tour')
        return p
      }, { replace: true })
    } else if (!tourDone && workspace.tracks.length === 0) setTourOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, searchParams])

  const finishTour = () => {
    if (userId) onboardingState.setTourDone(userId)
    setTourDone(true)
    setTourOpen(false)
    showToast({ id: 'tour-done', title: 'Tour complete · Explorer unlocked', message: 'Your first quest is done. The rest come from real work.', type: 'success' })
  }

  // Momentum uses the last 14 days of real completions, kept in step with today's toggles.
  const momentum = useMemo(() => {
    const today = getTodayDateString()
    const rows = recent.filter((r) => r.completed_date !== today).map((r) => ({ item_id: r.item_id, completed_date: r.completed_date }))
    actions.completedTodayIds.forEach((id) => rows.push({ item_id: id, completed_date: today }))
    return calcMomentum(items, rows)
  }, [recent, items, actions.completedTodayIds])

  if (loading) return <LoadingState label="Preparing today’s queue…" />
  if (error) return <ErrorState message={error} onRetry={() => void loadData()} />

  const todayStr = getTodayDateString()
  const skippedToday = skips.filter((s) => s.date === todayStr)
  const groups = groupTodayItems(items, actions.completedTodayIds, new Date(), {
    focusIds,
    historyByItem: actions.completionDates,
    skippedIds: skippedToday.map((s) => s.item_id),
  })
  const skipReasonFor = (id: string) => SKIP_REASONS.find((r) => r.value === skippedToday.find((s) => s.item_id === id)?.reason)?.label ?? 'Skipped'

  const skipItem = (item: ExecutionItem, reason: SkipReason) => {
    if (!userId) return
    setSkips(addSkip(userId, item.id, reason))
    showToast({ id: `skip-${item.id}`, title: `Skipped today: ${item.name}`, message: 'Not counted as a miss. Undo from the Skipped section.', type: 'info' })
  }
  const unskipItem = (item: ExecutionItem) => {
    if (!userId) return
    setSkips(removeSkip(userId, item.id))
  }
  const rescheduleItem = async (item: ExecutionItem, due: string) => {
    try {
      await actions.saveEdit(item.id, { due_date: due })
      showToast({ id: `resched-${item.id}`, title: `Moved to ${new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, message: item.name, type: 'info' })
    } catch (err) {
      showToast({ title: 'Could not move the item', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    }
  }
  const summary = todaySummary(groups)
  const totalOpen = groups.focus.length + groups.overdue.length + groups.dueToday.length + groups.anytime.length
  const byId = new Map(items.map((i) => [i.id, i]))
  const focusSet = new Set(focusIds)

  const toggleFocus = (item: ExecutionItem) => {
    if (!userId) return
    const next = toggleFocusId(userId, item.id)
    if (next && !focusUsed) {
      onboardingState.setFocusUsed(userId)
      setFocusUsed(true)
    }
    if (!next) {
      showToast({
        id: 'focus-full',
        title: `Focus holds ${MAX_FOCUS} items`,
        message: 'Remove one from today’s focus first. Keeping it short keeps it meaningful.',
        type: 'info',
      })
      return
    }
    setFocusIds(next)
  }

  const renderCard = (item: ExecutionItem) => {
    const weekly =
      item.type === 'habit'
        ? weeklyTargetStatus(item.schedule, actions.completionDates[item.id] ?? [], getTodayDateString())
        : null
    return (
      <ExecutionItemCard
        key={item.id}
        item={item}
        isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
        streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
        weekDone={weekly?.done}
        context={context.get(item.plan_id) ?? null}
        focused={focusSet.has(item.id)}
        onToggleFocus={toggleFocus}
        onToggleChecklistEntry={(it, entryId) => void actions.toggleChecklistEntry(it, entryId)}
        onReschedule={(it, due) => void rescheduleItem(it, due)}
        onSkip={skipItem}
        onToggleStatus={(id) => {
          const it = byId.get(id)
          if (it) void actions.toggle(it)
        }}
        onUpdateCount={(id, n) => {
          const it = byId.get(id)
          if (it) void actions.setCount(it, n)
        }}
        onStepCount={(id, delta) => {
          const it = byId.get(id)
          if (it) void actions.step(it, delta)
        }}
        onEdit={(it) => setEditingItem(it)}
        onSnoozeReminder={actions.snooze}
        onRemoveReminder={actions.removeReminder}
        busy={actions.busyIds.has(item.id)}
      />
    )
  }

  const section = (
    title: string,
    list: ExecutionItem[],
    opts: { danger?: boolean; icon?: 'clock' | 'star'; muted?: boolean; hint?: string } = {},
  ) =>
    list.length > 0 && (
      <section
        className={`section today-section${opts.muted ? ' today-section--muted' : ''}`}
        aria-label={`${title} (${list.length})`}
      >
        <div className="section__head">
          <h2 className="t-h2" style={opts.danger ? { color: 'var(--danger)' } : opts.muted ? { color: 'var(--text-secondary)' } : undefined}>
            {opts.icon === 'clock' && <Clock size={16} aria-hidden="true" />}
            {opts.icon === 'star' && <Star size={16} aria-hidden="true" />} {title} ({list.length})
          </h2>
          {opts.hint && <span className="t-meta">{opts.hint}</span>}
        </div>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {list.map(renderCard)}
        </div>
      </section>
    )

  const nothingAtAll = items.filter((i) => i.status !== 'archived').length === 0
  const canCreate = workspace.plans.length > 0
  const todayArcs = groupArcs(workspace.plans as Plan[], [], new Date()).filter((a) => a.timeline?.phase !== 'ended')
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <PageHeader
        eyebrow={`${greeting()}${displayName ? `, ${displayName.split(' ')[0]}` : ''}`}
        title="Today"
        description={dateLabel}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> <span>Add item</span>
            </Button>
          ) : undefined
        }
      />

      {!nothingAtAll && (
        <div className="today-summary" aria-label="Today’s progress">
          <div className="today-summary__main">
            <span className="today-summary__count">
              {summary.done} of {summary.total} done
            </span>
            <div
              className="today-summary__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.percent}
              aria-label="Today’s work completed"
            >
              <span style={{ width: `${summary.percent}%` }} />
            </div>
          </div>
          <div className="today-summary__momentum" title={momentum.explanation}>
            <span className="t-meta">Momentum</span>
            <span className="today-summary__score">
              {momentum.score}
              <span className="t-meta"> · {momentum.label}</span>
            </span>
            <span className="sr-only">{momentum.explanation}</span>
          </div>
          {progress && !gentle && <LevelStrip level={progress.level} streak={progress.streak} week={progress.week} />}
          {progress && gentle && progress.week && progress.week.planned > 0 && (
            <span className="t-meta" style={{ flexBasis: '100%' }}>
              This week {progress.week.done}/{progress.week.planned} planned
            </span>
          )}
        </div>
      )}

      {progress && !gentle && !questsDismissed && (
        <QuestCard
          quests={progress.quests}
          onTour={() => setTourOpen(true)}
          onDismiss={() => {
            if (userId) onboardingState.setQuestsDismissed(userId)
            setQuestsDismissed(true)
          }}
        />
      )}

      {todayArcs.length > 0 && (
        <nav className="row" aria-label="Your Arcs" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          {todayArcs.map((arc) => (
            <Link key={arc.key} to={arcPath(arc)} className="badge" style={{ textDecoration: 'none', minHeight: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Layers size={12} aria-hidden="true" />
              {arc.name}
              {arc.timeline
                ? arc.timeline.phase === 'not_started'
                  ? ` · starts in ${arc.timeline.startsInDays}d`
                  : ` · Day ${arc.timeline.day} of ${arc.timeline.totalDays}`
                : ''}
            </Link>
          ))}
        </nav>
      )}

      {nothingAtAll ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title={workspace.tracks.length ? 'Nothing planned yet' : 'Start with one area of your life'}
          description={
            workspace.tracks.length
              ? 'Add a habit or task to one of your active Plans and it will show up here.'
              : `Pick a ready-made setup, or create ${terms.track === 'Track' ? 'a Track' : 'an Area'} (like Health or Career), start a ${terms.plan} inside it, and add your first habit or task.`
          }
          action={
            canCreate ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={16} /> Add your first item
              </Button>
            ) : (
              <ButtonLink to={workspace.tracks.length ? '/tracks' : '/start'} variant="primary">
                {workspace.tracks.length ? `Open your ${terms.tracks}` : 'Get started'}
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          {totalOpen === 0 && (
            <div className="alert alert--success" role="status">
              {groups.completedToday.length > 0
                ? 'All caught up for today. Completed items are listed below if you need to undo one.'
                : 'Nothing is due today.'}
            </div>
          )}
          {groups.focus.length === 0 && totalOpen > 1 && (
            <p className="t-meta today-hint">
              <Star size={12} aria-hidden="true" /> Tip: star up to {MAX_FOCUS} items to make them today’s focus.
            </p>
          )}
          {section('Focus', groups.focus, { icon: 'star', hint: `${groups.focus.length}/${MAX_FOCUS}` })}
          {section('Overdue', groups.overdue, { danger: true })}
          {section('Due Today', groups.dueToday)}
          {section('Anytime', groups.anytime)}
          {section('Upcoming', groups.upcoming, { icon: 'clock' })}
          {section('Completed Today', groups.completedToday, { muted: true })}
          {groups.skipped.length > 0 && (
            <section className="section today-section today-section--muted" aria-label={`Skipped today (${groups.skipped.length})`}>
              <div className="section__head">
                <h2 className="t-h2" style={{ color: 'var(--text-secondary)' }}>
                  Skipped today ({groups.skipped.length})
                </h2>
                <span className="t-meta">Not counted as missed</span>
              </div>
              <ul className="skipped-list">
                {groups.skipped.map((it) => (
                  <li key={it.id} className="skipped-list__item">
                    <span>
                      <strong>{it.name}</strong> <span className="t-meta">· {skipReasonFor(it.id)}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => unskipItem(it)}>
                      Undo
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} onFinish={finishTour} />

      <EditItemModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSubmit={actions.saveEdit}
        completedToday={editingItem ? actions.completedTodayIds.has(editingItem.id) : false}
      />

      {userId && canCreate && (
        <CreateItemModal
          open={creating}
          onClose={() => setCreating(false)}
          plans={workspace.plans.map((p) => ({ id: p.id, label: context.get(p.id)?.label ?? p.name, track_id: p.track_id }))}
          onSubmit={async (input, reminder) => {
            await actions.create(input, reminder)
            setCreating(false)
            void loadData({ silent: true })
          }}
        />
      )}
    </div>
  )
}

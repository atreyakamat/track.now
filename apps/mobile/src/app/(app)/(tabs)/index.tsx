import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import * as Haptics from 'expo-haptics'
import { hasCompletedOnboarding } from '@tracknow/core/services/onboardingService'
import { onboardingState } from '@tracknow/core/services/onboardingState'
import { loadPreferences, onPreferencesChange } from '@tracknow/core/services/preferences'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listTodayWorkspace,
  type TodayWorkspace,
} from '@tracknow/core/services/executionService'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import { loadFocusIds, toggleFocusId } from '@tracknow/core/services/focusService'
import { pushFocus, syncFocus } from '@tracknow/core/services/syncedState'
import { addSkip, loadSkips, removeSkip, skippedDatesByItem, SKIP_REASONS, type SkipReason } from '@tracknow/core/services/skipService'
import { addDaysTo } from '@tracknow/core/domain/schedule'
import { FadeIn } from '@/components/ui/Motion'
import { reconcileRemindersWithActiveItems } from '@tracknow/core/services/reminderService'
import { getTodayDateString, greeting } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { groupTodayItems, MAX_FOCUS, todaySummary } from '@tracknow/core/domain/today'
import { calcAchievements, calcMomentum, computeXp, levelFor } from '@tracknow/core/domain/momentum'
import { buildWeeklyRecap, daysSinceLastCompletion, encouragement, newlyEarned, recapHeadline } from '@tracknow/core/domain/recap'
import { activeDayStreak, calcQuests, questXp, type Quest } from '@tracknow/core/domain/quests'
import { buildRetention } from '@tracknow/core/domain/retention'
import { weeklyTargetStatus } from '@tracknow/core/domain/schedule'
import { groupArcs } from '@tracknow/core/domain/arcs'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { updateTodayWidget } from '@/widgets/update'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { PageHeader } from '@/components/PageHeader'
import { LevelStrip } from '@/components/insights/LevelStrip'
import { QuestCard } from '@/components/onboarding/QuestCard'
import { TourModal } from '@/components/onboarding/TourModal'
import { arcPath } from '@/components/plans/ArcCard'
import { Card, EmptyState, ErrorState, ListSkeleton, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const EMPTY_WORKSPACE: TodayWorkspace = { items: [], plans: [], tracks: [] }
const LIFETIME_START = '2000-01-01'

/** Wraps a card so a left-swipe reveals a "Done" action that completes the item. */
function SwipeToComplete({ children, onComplete, actionColor, iconColor }: { children: React.ReactNode; onComplete: () => void; actionColor: string; iconColor: string }) {
  const ref = useRef<React.ComponentRef<typeof ReanimatedSwipeable>>(null)
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableOpen={() => {
        ref.current?.close()
        onComplete()
      }}
      renderRightActions={() => (
        <View style={{ width: 96, marginLeft: spacing[2], borderRadius: radius.lg, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Feather name="check" size={22} color={iconColor} />
          <Text variant="meta" style={{ color: iconColor }} weight="semibold">
            Done
          </Text>
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  )
}

/** Floating "+" to quickly add an item: pick an active Plan, or go to the planner if none. */
function QuickAddFab({ plans, loading }: { plans: { id: string; label: string; track_id: string }[]; loading: boolean }) {
  const { colors } = useTheme()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const choose = (plan: { id: string; track_id: string }) => {
    setOpen(false)
    router.push(`/item/new?planId=${plan.id}${plan.track_id ? `&trackId=${plan.track_id}` : ''}`)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="Add item"
        accessibilityRole="button"
        style={{
          position: 'absolute',
          right: spacing[4],
          bottom: spacing[5],
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.controlBg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Feather name="plus" size={26} color={colors.controlText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[4], paddingBottom: spacing[7], gap: spacing[3], maxHeight: '70%' }}
          >
            <Text variant="h3">Add to a Plan</Text>
            {loading ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : plans.length > 0 ? (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing[2] }}>
                {plans.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => choose(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add an item to ${p.label}`}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[3], paddingHorizontal: spacing[3], borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
                  >
                    <Text variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {p.label}
                    </Text>
                    <Feather name="chevron-right" size={18} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={{ gap: spacing[3] }}>
                <Text variant="caption" tone="secondary">
                  You don’t have an active Plan yet. Start with a goal and we’ll set one up.
                </Text>
                <Pressable
                  onPress={() => {
                    setOpen(false)
                    router.push('/guide')
                  }}
                  accessibilityRole="button"
                  style={{ paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: colors.controlBg, alignItems: 'center' }}
                >
                  <Text variant="caption" weight="semibold" style={{ color: colors.controlText }}>
                    Plan a goal
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

export default function TodayScreen() {
  const { user, displayName } = useAuth()
  const { showToast } = useToast()
  const userId = user?.id
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [workspace, setWorkspace] = useState<TodayWorkspace>(EMPTY_WORKSPACE)
  const [ledger, setLedger] = useState<CompletionRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusIds, setFocusIds] = useState<string[]>(() => (userId ? loadFocusIds(userId) : []))
  const [tourOpen, setTourOpen] = useState(false)
  const [skips, setSkips] = useState(() => (userId ? loadSkips(userId) : []))
  const [sheetItem, setSheetItem] = useState<ExecutionItem | null>(null)
  const [gentle, setGentle] = useState(() => (userId ? loadPreferences(userId).gamification === 'gentle' : false))
  useEffect(() => onPreferencesChange((p) => setGentle(p.gamification === 'gentle')), [])
  const [tourDone, setTourDone] = useState(() => (userId ? onboardingState.tourDone(userId) : false))
  const [focusUsed, setFocusUsed] = useState(() => (userId ? onboardingState.focusUsed(userId) : false))
  const [questsDismissed, setQuestsDismissed] = useState(() => (userId ? onboardingState.questsDismissed(userId) : false))
  const [recapDismissed, setRecapDismissed] = useState<string | null>(() => (userId ? onboardingState.recapDismissedFor(userId) : null))
  const requestRef = useRef(0)
  const hasDataRef = useRef(false)
  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  // First run on this device: send the user to the welcome screen once.
  const onboardingChecked = useRef(false)
  useEffect(() => {
    if (onboardingChecked.current) return
    onboardingChecked.current = true
    if (!hasCompletedOnboarding()) router.replace('/welcome')
  }, [router])

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId) return
      const requestId = ++requestRef.current
      const snapshot = actionsRef.current?.snapshotToken() ?? 0
      try {
        if (!opts.silent) setLoading(true)
        else setRefreshing(true)
        setError(null)
        const today = getTodayDateString()
        const [ws, todayIds, lifetime] = await Promise.all([
          listTodayWorkspace(),
          listCompletionsForDate(userId, today),
          listCompletionHistory(userId, LIFETIME_START).catch(() => null),
        ])
        const habitIds = ws.items.filter((i) => i.type === 'habit').map((h) => h.id)
        const history = habitIds.length ? await listCompletionsForItems(habitIds, addDays(today, -400)) : {}
        if (requestId !== requestRef.current) return
        // Taps saved while this was loading are newer than this snapshot: skip it (the hook re-syncs).
        if (actionsRef.current && !actionsRef.current.acceptSnapshot(snapshot)) return
        setItems(ws.items)
        setWorkspace(ws)
        if (lifetime) setLedger(lifetime)
        actionsRef.current?.setCompletionState(todayIds, history)
        setFocusIds(loadFocusIds(userId))
        // Focus picked on another device today: take it over (the newest change wins).
        void syncFocus(userId).then((result) => {
          if (result.ids && requestId === requestRef.current) setFocusIds(result.ids)
        })
        reconcileRemindersWithActiveItems(userId, ws.items.map((i) => i.id))
        updateTodayWidget(ws.items, new Set(todayIds))
        hasDataRef.current = true
      } catch (err) {
        if (requestId !== requestRef.current) return
        const message = err instanceof Error ? err.message : 'Failed to load today’s items.'
        // A failed background refresh must never blank a page the user is already looking at:
        // keep what is shown and say the refresh failed instead.
        if (opts.silent && hasDataRef.current) {
          showToast({ id: 'refresh-failed', title: 'Could not refresh', message: 'Showing the last loaded state.', type: 'warning' })
        } else {
          setError(message)
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [userId, showToast],
  )

  const actions = useExecutionItemActions({
    userId,
    items,
    setItems,
    reload: () => loadData({ silent: true }),
    onChanged: ({ items: list, completedTodayIds }) => updateTodayWidget(list, new Set(completedTodayIds)),
  })
  actionsRef.current = actions

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Reload when returning to the tab, and honour a tour request from Settings.
  useFocusEffect(
    useCallback(() => {
      void loadData({ silent: true })
      if (userId && onboardingState.tourRequested(userId)) {
        onboardingState.setTourRequested(userId, false)
        setTourOpen(true)
      }
      if (userId) setQuestsDismissed(onboardingState.questsDismissed(userId))
    }, [loadData, userId]),
  )

  const context = useMemo(() => {
    const trackName = new Map(workspace.tracks.map((t) => [t.id, t.name]))
    const map = new Map<string, { label: string; planId: string; onPress: () => void }>()
    for (const p of workspace.plans) {
      const t = trackName.get(p.track_id)
      map.set(p.id, { label: t ? `${p.name} · ${t}` : p.name, planId: p.id, onPress: () => router.push(`/plan/${p.id}`) })
    }
    return map
  }, [workspace, router])

  // Momentum, level, streak, quests and this week's planned work, in step with today's toggles.
  // This walks the whole completion history, so it reads deferred copies: a tap redraws the
  // list first and the level / streak / quests follow a moment later, without blocking the tick.
  const deferredItems = useDeferredValue(items)
  const deferredDoneIds = useDeferredValue(actions.completedTodayIds)
  const progress = useMemo(() => {
    if (!ledger || loading) return null
    const items = deferredItems
    const today = getTodayDateString()
    const rows = ledger.filter((r) => r.completed_date !== today).map((r) => ({ item_id: r.item_id, completed_date: r.completed_date }))
    deferredDoneIds.forEach((id) => rows.push({ item_id: id, completed_date: today }))
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
    const longestDailyStreak = Object.values(actions.streakSummaries).reduce((best, s) => Math.max(best, s.longestStreak), 0)
    return {
      momentum: calcMomentum(items, rows),
      level: levelFor(xp),
      streak: activeDayStreak(rows, today, addDays(today, -1)),
      quests,
      week: week ? { done: week.done, planned: week.planned } : null,
      achievements: calcAchievements({ completions: rows, items, plans, longestDailyStreak, extras: { tourCompleted: tourDone }, habits: items.filter((i) => i.type === 'habit') }),
      recap: buildWeeklyRecap(rows, today),
      daysAway: daysSinceLastCompletion(rows, today),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, loading, deferredDoneIds, deferredItems, workspace, tourDone, focusUsed, skips, actions.streakSummaries])

  // Announce a newly earned achievement once (what was announced is remembered per user on this
  // device). The first run records what is already earned without a toast.
  useEffect(() => {
    if (!userId || !progress || gentle) return
    const seen = onboardingState.seenAchievements(userId)
    const earnedIds = progress.achievements.filter((a) => a.earned).map((a) => a.id)
    const fresh = newlyEarned(progress.achievements, seen)
    if (seen === null || fresh.length) onboardingState.setSeenAchievements(userId, earnedIds)
    if (fresh.length) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    fresh.slice(0, 2).forEach((a) => showToast({ id: `achievement-${a.id}`, title: `Achievement: ${a.title}`, message: a.description, type: 'success', duration: 8000 }))
  }, [progress, userId, gentle, showToast])

  // Announce a level-up once (the last level seen is remembered per user on this device).
  useEffect(() => {
    if (!userId || !progress) return
    const last = onboardingState.lastLevel(userId)
    if (last && progress.level.level > last) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast({ id: `level-${progress.level.level}`, title: `Level ${progress.level.level}: ${progress.level.name}`, message: 'Earned from your completions alone. Keep going.', type: 'success', duration: 8000 })
    }
    if (progress.level.level !== last) onboardingState.setLastLevel(userId, progress.level.level)
  }, [progress, userId, showToast])

  const finishTour = () => {
    if (userId) onboardingState.setTourDone(userId)
    setTourDone(true)
    setTourOpen(false)
    showToast({ id: 'tour-done', title: 'Tour complete · Explorer unlocked', message: 'Your first quest is done. The rest come from real work.', type: 'success' })
  }

  const onQuest = (q: Quest) => {
    if (q.id === 'tour') return setTourOpen(true)
    if (q.id === 'first_track') return router.push('/track/new')
    if (q.id === 'first_plan' || q.id === 'arc') return router.push('/(app)/(tabs)/tracks')
  }

  // Stable handlers: the item cards are memoised and only redraw when their own data changes.
  const toggleFocus = useCallback(
    (item: ExecutionItem) => {
      if (!userId) return
      const next = toggleFocusId(userId, item.id)
      if (next && !focusUsed) {
        onboardingState.setFocusUsed(userId)
        setFocusUsed(true)
      }
      if (!next) {
        showToast({ id: 'focus-full', title: `Focus holds ${MAX_FOCUS} items`, message: 'Remove one from today’s focus first.', type: 'info' })
        return
      }
      setFocusIds(next)
      void pushFocus(userId)
    },
    [userId, focusUsed, showToast],
  )
  const openEdit = useCallback((it: ExecutionItem) => router.push(`/item/${it.id}/edit`), [router])
  const openDetail = useCallback((it: ExecutionItem) => router.push(`/item/${it.id}`), [router])

  const focusSet = new Set(focusIds)
  const todayStr = getTodayDateString()
  const skippedToday = skips.filter((s) => s.date === todayStr)
  const skipReasonFor = (id: string) => SKIP_REASONS.find((r) => r.value === skippedToday.find((s) => s.item_id === id)?.reason)?.label ?? 'Skipped'

  const skipItem = (item: ExecutionItem, reason: SkipReason) => {
    if (!userId) return
    setSkips(addSkip(userId, item.id, reason))
    setSheetItem(null)
    showToast({ id: `skip-${item.id}`, title: `Skipped today: ${item.name}`, message: 'Not counted as a miss.', type: 'info' })
  }
  const rescheduleItem = async (item: ExecutionItem, due: string) => {
    setSheetItem(null)
    try {
      await actions.saveEdit(item.id, { due_date: due })
      showToast({ id: `resched-${item.id}`, title: `Moved to ${new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, message: item.name, type: 'info' })
    } catch (err) {
      showToast({ title: 'Could not move the item', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    }
  }
  const liveById = new Map(items.map((i) => [i.id, i]))
  const renderCard = (grouped: ExecutionItem, swipe = false) => {
    // `grouped` decides the section; the card itself always shows the live item.
    const item = liveById.get(grouped.id) ?? grouped
    const weekly = item.type === 'habit' ? weeklyTargetStatus(item.schedule, actions.completionDates[item.id] ?? [], getTodayDateString()) : null
    const ctx = context.get(item.plan_id)
    const card = (
      <ExecutionItemCard
        item={item}
        busy={actions.busyIds.has(item.id)}
        isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
        streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
        weekDone={weekly?.done}
        context={ctx ?? null}
        focused={focusSet.has(item.id)}
        onToggleFocus={toggleFocus}
        onToggleChecklistEntry={actions.toggleChecklistEntry}
        onMore={setSheetItem}
        onToggle={actions.toggle}
        onStep={actions.step}
        onEdit={openEdit}
        onOpenDetail={openDetail}
        onSnooze={actions.snooze}
        onRemoveReminder={actions.removeReminder}
      />
    )
    if (!swipe) return <View key={item.id}>{card}</View>
    return (
      <SwipeToComplete key={item.id} onComplete={() => actions.toggle(item)} actionColor={colors.success} iconColor={colors.controlText}>
        {card}
      </SwipeToComplete>
    )
  }

  const section = (title: string, list: ExecutionItem[], opts?: { tone?: 'danger' | 'muted'; swipe?: boolean; icon?: React.ComponentProps<typeof Feather>['name']; hint?: string }) =>
    list.length > 0 ? (
      <View style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {opts?.icon ? <Feather name={opts.icon} size={13} color={opts?.tone === 'danger' ? colors.danger : colors.textSecondary} /> : null}
            <Text variant="meta" style={{ color: opts?.tone === 'danger' ? colors.danger : opts?.tone === 'muted' ? colors.textTertiary : colors.textSecondary }}>
              {title} ({list.length})
            </Text>
          </View>
          {opts?.hint ? (
            <Text variant="meta" tone="tertiary">
              {opts.hint}
            </Text>
          ) : null}
        </View>
        {list.map((it, i) => (
          <FadeIn key={it.id} index={i}>
            {renderCard(it, opts?.swipe ?? false)}
          </FadeIn>
        ))}
      </View>
    ) : null

  const groupOptions = { focusIds, historyByItem: actions.completionDates, skippedIds: skippedToday.map((s) => s.item_id) }
  // Sections use the "held" view: a just-ticked item stays put for a moment so the tick is seen
  // before the item moves to Completed. Counts use the live state, so they update at once.
  const groups = groupTodayItems(actions.groupingItems, actions.groupingCompletedIds, new Date(), groupOptions)
  const liveGroups = groupTodayItems(items, actions.completedTodayIds, new Date(), groupOptions)
  const summary = todaySummary(liveGroups)
  const encourage = encouragement({ done: summary.done, total: summary.total, daysAway: progress?.daysAway ?? null, streak: progress?.streak ?? 0 })
  const totalOpen = liveGroups.focus.length + liveGroups.overdue.length + liveGroups.dueToday.length + liveGroups.anytime.length
  const nothingAtAll = items.filter((i) => i.status !== 'archived').length === 0
  const allDone = !loading && !nothingAtAll && totalOpen === 0 && groups.completedToday.length > 0
  const todayArcs = groupArcs(workspace.plans as Plan[], [], new Date()).filter((a) => a.timeline?.phase !== 'ended')
  const quickAddPlans = workspace.plans.map((p) => ({ id: p.id, label: context.get(p.id)?.label ?? p.name, track_id: p.track_id }))

  // Celebrate the moment the last item of the day is cleared (once per transition).
  const wasAllDone = useRef(false)
  useEffect(() => {
    if (allDone && !wasAllDone.current) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    wasAllDone.current = allDone
  }, [allDone])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] + 56 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData({ silent: true })} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="Today"
          subtitle={`${greeting()}${displayName ? `, ${displayName.split(' ')[0]}` : ''} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
          right={
            <View style={{ flexDirection: 'row', gap: spacing[1] }}>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Open the calendar" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="calendar" size={20} color={colors.textPrimary} />
              </Pressable>
              <Pressable onPress={() => router.push('/library')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Open the plan library" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="book" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          }
        />

        {loading ? (
          <View style={{ gap: spacing[4] }}>
            <ListSkeleton count={5} />
          </View>
        ) : error ? (
          <ErrorState description={error} onRetry={() => loadData()} />
        ) : (
          <View style={{ gap: spacing[4] }}>
            {!nothingAtAll ? (
              <Card style={{ gap: spacing[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text variant="h3">
                      {summary.done} of {summary.total} done
                    </Text>
                    {encourage ? (
                      <Text variant="caption" tone="secondary">
                        {encourage}
                      </Text>
                    ) : null}
                    <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: summary.percent }}>
                      <View style={{ width: `${summary.percent}%`, height: '100%', backgroundColor: colors.controlBg }} />
                    </View>
                  </View>
                  {progress ? (
                    <View style={{ alignItems: 'flex-end' }} accessibilityLabel={progress.momentum.explanation}>
                      <Text variant="meta" tone="tertiary">
                        Momentum
                      </Text>
                      <Text variant="h3">
                        {progress.momentum.score}{' '}
                        <Text variant="caption" tone="secondary">
                          {progress.momentum.label}
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
                {progress && !gentle ? <LevelStrip level={progress.level} streak={progress.streak} week={progress.week} onPress={() => router.push('/(app)/(tabs)/analytics')} /> : null}
              </Card>
            ) : null}

            {progress?.recap && recapDismissed !== progress.recap.weekStart ? (
              <Card style={{ gap: spacing[1] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="h3">Your last week</Text>
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Hide last week's recap"
                    onPress={() => {
                      if (userId && progress.recap) onboardingState.setRecapDismissedFor(userId, progress.recap.weekStart)
                      setRecapDismissed(progress.recap?.weekStart ?? null)
                    }}
                  >
                    <Feather name="x" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text variant="caption" tone="secondary">
                  {recapHeadline(progress.recap)}
                  {progress.recap.bestDay && progress.recap.bestDay.count > 1
                    ? ` Your best day was ${new Date(`${progress.recap.bestDay.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })} with ${progress.recap.bestDay.count}.`
                    : ''}
                </Text>
              </Card>
            ) : null}

            {progress && !gentle && !questsDismissed ? (
              <QuestCard
                quests={progress.quests}
                onQuest={onQuest}
                onDismiss={() => {
                  if (userId) onboardingState.setQuestsDismissed(userId)
                  setQuestsDismissed(true)
                }}
              />
            ) : null}

            {todayArcs.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {todayArcs.map((arc) => (
                  <Pressable
                    key={arc.key}
                    onPress={() => router.push(arcPath(arc))}
                    accessibilityRole="button"
                    accessibilityLabel={`Open the Arc ${arc.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], minHeight: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }}
                  >
                    <Feather name="layers" size={12} color={colors.textSecondary} />
                    <Text variant="meta" tone="secondary">
                      {arc.name}
                      {arc.timeline ? (arc.timeline.phase === 'not_started' ? ` · starts in ${arc.timeline.startsInDays}d` : ` · Day ${arc.timeline.day} of ${arc.timeline.totalDays}`) : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {nothingAtAll ? (
              <EmptyState
                icon={<Feather name="check-circle" size={22} color={colors.textSecondary} />}
                title={workspace.tracks.length ? 'Nothing planned yet' : 'Start with one area of your life'}
                description={
                  workspace.tracks.length
                    ? 'Add a habit or task to one of your active Plans and it will show up here.'
                    : 'Plan a goal for a guided setup, or create a Track and a Plan yourself.'
                }
                action={{ label: workspace.tracks.length ? 'Open your Tracks' : 'Plan a goal', onPress: () => router.push(workspace.tracks.length ? '/(app)/(tabs)/tracks' : '/guide') }}
              />
            ) : (
              <View style={{ gap: spacing[5] }}>
                {totalOpen === 0 ? (
                  <Card style={{ borderColor: colors.success, alignItems: 'center', gap: spacing[1], paddingVertical: spacing[4] }}>
                    {allDone ? (
                      <>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name="check" size={24} color={colors.controlText} />
                        </View>
                        <Text variant="h3" style={{ color: colors.success }} center>
                          All done for today
                        </Text>
                        <Text variant="meta" tone="tertiary" center>
                          {groups.completedToday.length} completed. Completed items are below if you need to undo one.
                        </Text>
                      </>
                    ) : (
                      <Text variant="caption" style={{ color: colors.success }} center>
                        Nothing is due today.
                      </Text>
                    )}
                  </Card>
                ) : null}
                {groups.focus.length === 0 && totalOpen > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="star" size={13} color={colors.textTertiary} />
                    <Text variant="meta" tone="tertiary">
                      Star up to {MAX_FOCUS} items to make them today’s focus. Swipe left to complete.
                    </Text>
                  </View>
                ) : null}
                {section('Focus', groups.focus, { swipe: true, icon: 'star', hint: `${groups.focus.length}/${MAX_FOCUS}` })}
                {section('Overdue', groups.overdue, { tone: 'danger', swipe: true })}
                {section('Due today', groups.dueToday, { swipe: true })}
                {section('Anytime', groups.anytime, { swipe: true })}
                {section('Upcoming', groups.upcoming, { icon: 'clock' })}
                {section('Completed today', groups.completedToday, { tone: 'muted' })}
                {groups.skipped.length > 0 ? (
                  <View style={{ gap: spacing[2] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="meta" tone="tertiary">
                        Skipped today ({groups.skipped.length})
                      </Text>
                      <Text variant="meta" tone="tertiary">
                        Not counted as missed
                      </Text>
                    </View>
                    {groups.skipped.map((it) => (
                      <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], paddingHorizontal: spacing[3], minHeight: 44, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: radius.md }}>
                        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                          {it.name} · {skipReasonFor(it.id)}
                        </Text>
                        <Pressable onPress={() => userId && setSkips(removeSkip(userId, it.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Undo skipping ${it.name}`}>
                          <Text variant="caption" weight="semibold">
                            Undo
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {!loading && !error ? <QuickAddFab plans={quickAddPlans} loading={false} /> : null}
      <TourModal visible={tourOpen} onClose={() => setTourOpen(false)} onFinish={finishTour} />

      <Modal visible={Boolean(sheetItem)} transparent animationType="slide" onRequestClose={() => setSheetItem(null)}>
        <Pressable onPress={() => setSheetItem(null)} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[4], paddingBottom: spacing[6], gap: spacing[2] }}>
            {sheetItem ? (
              <>
                <Text variant="h3" numberOfLines={2}>
                  {sheetItem.name}
                </Text>
                {sheetItem.type !== 'habit' ? (
                  <>
                    <Text variant="meta" tone="tertiary">
                      Move to
                    </Text>
                    {[
                      { label: 'Tomorrow', date: addDaysTo(todayStr, 1) },
                      { label: 'In 3 days', date: addDaysTo(todayStr, 3) },
                      { label: 'Next week', date: addDaysTo(todayStr, 7) },
                    ].map((o) => (
                      <Pressable key={o.label} onPress={() => void rescheduleItem(sheetItem, o.date)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
                        <Text variant="caption" weight="medium">
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}
                <Text variant="meta" tone="tertiary" style={{ marginTop: spacing[2] }}>
                  Skip today (not a miss)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  {SKIP_REASONS.map((r) => (
                    <Pressable key={r.value} onPress={() => skipItem(sheetItem, r.value)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong }}>
                      <Text variant="caption">{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

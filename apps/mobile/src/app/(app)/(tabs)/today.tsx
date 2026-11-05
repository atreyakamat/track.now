import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import * as Haptics from 'expo-haptics'
import { listPlans } from '@tracknow/core/services/plansService'
import type { Plan } from '@tracknow/core/types/domain'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listTodayExecutionItems,
} from '@tracknow/core/services/executionService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { reconcileRemindersWithActiveItems } from '@tracknow/core/services/reminderService'
import { addDays } from '@tracknow/core/domain/streaks'
import { groupTodayItems } from '@tracknow/core/domain/today'
import { greeting } from '@tracknow/core/utils/format'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { updateTodayWidget } from '@/widgets/update'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { PageHeader } from '@/components/PageHeader'
import { Card, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/** Wraps a card so a left-swipe reveals a "Done" action that completes the item. */
function SwipeToComplete({
  children,
  onComplete,
  actionColor,
  iconColor,
}: {
  children: React.ReactNode
  onComplete: () => void
  actionColor: string
  iconColor: string
}) {
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
        <View
          style={{
            width: 96,
            marginLeft: spacing[2],
            borderRadius: radius.lg,
            backgroundColor: actionColor,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
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

/** Floating "+" to quickly add an item: pick an active plan, or go to the planner if none. */
function QuickAddFab() {
  const { colors } = useTheme()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)

  const press = async () => {
    setOpen(true)
    if (plans) return
    setLoadingPlans(true)
    try {
      const all = await listPlans()
      setPlans(all.filter((p) => p.status === 'active'))
    } catch {
      setPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }

  const choose = (plan: Plan) => {
    setOpen(false)
    router.push(`/item/new?planId=${plan.id}${plan.track_id ? `&trackId=${plan.track_id}` : ''}`)
  }

  return (
    <>
      <Pressable
        onPress={press}
        accessibilityLabel="Quick add item"
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
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing[4],
              paddingBottom: spacing[7],
              gap: spacing[3],
            }}
          >
            <Text variant="h3">Add to a plan</Text>
            {loadingPlans ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : plans && plans.length > 0 ? (
              <View style={{ gap: spacing[2] }}>
                {plans.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => choose(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add an item to ${p.name}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing[3],
                      paddingHorizontal: spacing[3],
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {p.name}
                    </Text>
                    <Feather name="chevron-right" size={18} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ gap: spacing[3] }}>
                <Text variant="caption" tone="secondary">
                  You don’t have a plan yet. Start with a goal and we’ll set one up.
                </Text>
                <Pressable
                  onPress={() => {
                    setOpen(false)
                    router.push('/guide')
                  }}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: spacing[3],
                    borderRadius: radius.md,
                    backgroundColor: colors.controlBg,
                    alignItems: 'center',
                  }}
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
  const userId = user?.id
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)
  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId) return
      const requestId = ++requestRef.current
      try {
        if (!opts.silent) setLoading(true)
        else setRefreshing(true)
        setError(null)
        const today = getTodayDateString()
        const [allItems, todayIds] = await Promise.all([
          listTodayExecutionItems(),
          listCompletionsForDate(userId, today),
        ])
        const habitIds = allItems.filter((i) => i.type === 'habit').map((h) => h.id)
        const history = habitIds.length ? await listCompletionsForItems(habitIds, addDays(today, -400)) : {}
        if (requestId !== requestRef.current) return
        setItems(allItems)
        actionsRef.current?.setCompletionState(todayIds, history)
        reconcileRemindersWithActiveItems(userId, allItems.map((i) => i.id))
        updateTodayWidget(allItems, new Set(todayIds))
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load today’s items.')
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [userId],
  )

  const actions = useExecutionItemActions({
    userId,
    items,
    setItems,
    reload: () => loadData({ silent: true }),
  })
  actionsRef.current = actions

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Reload when returning to the tab (e.g. after adding/editing an item elsewhere, or when
  // the day has rolled over). loadData re-reads today's date internally and re-buckets.
  useFocusEffect(
    useCallback(() => {
      void loadData({ silent: true })
    }, [loadData]),
  )

  const renderCard = (item: ExecutionItem, swipe = false) => {
    const card = (
      <ExecutionItemCard
        item={item}
        busy={actions.busyIds.has(item.id)}
        isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
        streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
        onToggle={actions.toggle}
        onStep={actions.step}
        onEdit={(it) => router.push(`/item/${it.id}/edit`)}
        onOpenDetail={(it) => router.push(`/item/${it.id}`)}
        onSnooze={actions.snooze}
        onRemoveReminder={actions.removeReminder}
      />
    )
    if (!swipe) return <View key={item.id}>{card}</View>
    return (
      <SwipeToComplete
        key={item.id}
        onComplete={() => actions.toggle(item)}
        actionColor={colors.success}
        iconColor={colors.controlText}
      >
        {card}
      </SwipeToComplete>
    )
  }

  const section = (title: string, list: ExecutionItem[], opts?: { tone?: 'danger' | 'muted'; swipe?: boolean }) =>
    list.length > 0 ? (
      <View style={{ gap: spacing[2] }}>
        <Text variant="meta" style={{ color: opts?.tone === 'danger' ? colors.danger : opts?.tone === 'muted' ? colors.textTertiary : colors.textSecondary }}>
          {title} ({list.length})
        </Text>
        {list.map((it) => renderCard(it, opts?.swipe ?? false))}
      </View>
    ) : null

  const groups = groupTodayItems(items, actions.completedTodayIds)
  const totalOpen = groups.overdue.length + groups.dueToday.length + groups.anytime.length
  const nothingAtAll = items.filter((i) => i.status !== 'archived').length === 0
  const allDone = !loading && !nothingAtAll && totalOpen === 0 && groups.completedToday.length > 0

  // Celebrate the moment the last item of the day is cleared (once per transition).
  const wasAllDone = useRef(false)
  useEffect(() => {
    if (allDone && !wasAllDone.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    }
    wasAllDone.current = allDone
  }, [allDone])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData({ silent: true })} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Today" subtitle={`${greeting()}, ${displayName}.`} />

        {loading ? (
          <LoadingState label="Preparing today’s queue…" />
        ) : error ? (
          <ErrorState description={error} onRetry={() => loadData()} />
        ) : nothingAtAll ? (
          <EmptyState
            icon={<Feather name="check-circle" size={22} color={colors.textSecondary} />}
            title="No items yet"
            description="Create a plan inside one of your tracks and add habits or tasks to see them here."
            action={{ label: 'Go to tracks', onPress: () => router.push('/(app)/(tabs)/tracks') }}
          />
        ) : (
          <View style={{ gap: spacing[5] }}>
            {totalOpen === 0 ? (
              <Card style={{ borderColor: colors.success, alignItems: 'center', gap: spacing[1], paddingVertical: spacing[4] }}>
                {allDone ? (
                  <>
                    <Text variant="display" style={{ fontSize: 32 }}>
                      🎉
                    </Text>
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
            {totalOpen > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="chevrons-left" size={13} color={colors.textTertiary} />
                <Text variant="meta" tone="tertiary">
                  Tap to complete, or swipe a card left.
                </Text>
              </View>
            ) : null}
            {section('Overdue', groups.overdue, { tone: 'danger', swipe: true })}
            {section('Due today', groups.dueToday, { swipe: true })}
            {section('Anytime', groups.anytime, { swipe: true })}
            {section('Upcoming', groups.upcoming)}
            {section('Completed today', groups.completedToday, { tone: 'muted' })}
          </View>
        )}
      </ScrollView>
      {!loading && !error ? <QuickAddFab /> : null}
    </SafeAreaView>
  )
}

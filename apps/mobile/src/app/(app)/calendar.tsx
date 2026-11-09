import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { editExecutionItem, listExecutionItems } from '@tracknow/core/services/executionService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listCompletionHistory } from '@tracknow/core/services/historyService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDaysTo, hasStarted, isFixedScheduleDay, weekStartOf, weeklyTarget } from '@tracknow/core/domain/schedule'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { Badge, Button, Card, ErrorState, LoadingState, Segmented, Text } from '@/components/ui'
import { FadeIn } from '@/components/ui/Motion'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, opts)

/** Calendar: "Plan my week" with one-tap moves, and a month grid. Reads items, writes only due dates. */
export default function CalendarScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const router = useRouter()
  const today = getTodayDateString()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today)
  const [moved, setMoved] = useState<Record<string, string>>({})

  const { data, loading, error, reload, refreshing } = useAsync(async () => {
    if (!user) return null
    const [items, plans, completions] = await Promise.all([listExecutionItems(), listPlans(), listCompletionHistory(user.id, addDaysTo(today, -60), addDaysTo(today, 1))])
    return { items, plans, completions }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const derived = useMemo(() => {
    if (!data) return null
    const activePlans = new Set(data.plans.filter((p) => p.status === 'active').map((p) => p.id))
    const planName = new Map(data.plans.map((p) => [p.id, p.name]))
    const doneOn = new Set(data.completions.map((c) => `${c.item_id}|${c.completed_date}`))
    const live = data.items.filter((i) => i.status !== 'archived' && activePlans.has(i.plan_id)).map((i) => (moved[i.id] ? { ...i, due_date: moved[i.id] } : i))
    const itemsOn = (date: string) =>
      live.filter((i) => {
        if (!hasStarted(i, date)) return false
        if (i.type === 'habit') return weeklyTarget(i.schedule) === null && isFixedScheduleDay(i.schedule, date)
        return i.due_date === date && (i.status !== 'done' || doneOn.has(`${i.id}|${date}`) || date >= today)
      })
    const isDone = (i: ExecutionItem, date: string) => doneOn.has(`${i.id}|${date}`) || (i.type !== 'habit' && i.status === 'done')
    return { planName, itemsOn, isDone }
  }, [data, moved, today])

  const reschedule = async (item: ExecutionItem, due: string) => {
    if (!user) return
    setMoved((m) => ({ ...m, [item.id]: due }))
    try {
      await editExecutionItem(item.id, { due_date: due }, user.id)
      showToast({ id: `resched-${item.id}`, title: `Moved to ${fmtDay(due)}`, message: item.name, type: 'info' })
    } catch (err) {
      setMoved((m) => {
        const next = { ...m }
        delete next[item.id]
        return next
      })
      showToast({ title: 'Could not move the item', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    }
  }

  const weekStart = weekStartOf(anchor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysTo(weekStart, i))
  const monthFirst = `${anchor.slice(0, 7)}-01`
  const gridStart = weekStartOf(monthFirst)
  const cells = Array.from({ length: 42 }, (_, i) => addDaysTo(gridStart, i))
  const monthLabel = new Date(`${monthFirst}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shiftMonth = (n: number) => {
    const [y, m] = anchor.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  const step = (dir: -1 | 1) => (view === 'week' ? setAnchor(addDaysTo(weekStart, 7 * dir)) : shiftMonth(dir))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: spacing[4] }}>
        <AppBar title="Calendar" />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[3] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { key: 'week', label: 'Plan my week' },
            { key: 'month', label: 'Month' },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => step(-1)} hitSlop={8} accessibilityLabel={view === 'week' ? 'Previous week' : 'Previous month'} style={{ padding: spacing[2] }}>
            <Feather name="chevron-left" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setAnchor(today)} accessibilityLabel="Go to today">
            <Text variant="caption" weight="semibold">
              {view === 'week' ? `${fmtDay(weekStart)} – ${fmtDay(addDaysTo(weekStart, 6))}` : monthLabel}
            </Text>
          </Pressable>
          <Pressable onPress={() => step(1)} hitSlop={8} accessibilityLabel={view === 'week' ? 'Next week' : 'Next month'} style={{ padding: spacing[2] }}>
            <Feather name="chevron-right" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {loading || !derived ? (
          error ? <ErrorState description={error} onRetry={reload} /> : <LoadingState label="Loading your calendar…" />
        ) : view === 'week' ? (
          weekDays.map((date, di) => {
            const list = derived.itemsOn(date)
            const isToday = date === today
            return (
              <FadeIn key={date} index={di}>
                <Card style={{ gap: spacing[2], borderColor: isToday ? colors.controlBg : colors.border, opacity: date < today ? 0.8 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <Text variant="h3">
                        {DOW[(new Date(`${date}T00:00:00`).getDay() + 6) % 7]} {fmtDay(date)}
                      </Text>
                      {isToday ? <Badge label="Today" tone="accent" /> : null}
                    </View>
                    <Text variant="meta" tone="tertiary">
                      {list.length ? `${list.length} planned` : 'Nothing planned'}
                    </Text>
                  </View>
                  {list.map((i) => {
                    const done = derived.isDone(i, date)
                    return (
                      <View key={i.id} style={{ gap: 4, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border, opacity: done ? 0.6 : 1 }}>
                        <Pressable onPress={() => router.push(`/plan/${i.plan_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
                          <Badge label={i.type} />
                          <Text variant="caption" weight="medium" style={{ flexShrink: 1, textDecorationLine: done ? 'line-through' : 'none' }}>
                            {i.name}
                          </Text>
                        </Pressable>
                        <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          {derived.planName.get(i.plan_id)}
                        </Text>
                        {i.type !== 'habit' && !done ? (
                          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                            <Button title="+1 day" size="sm" variant="ghost" onPress={() => void reschedule(i, addDaysTo(date, 1))} />
                            <Button title="Next week" size="sm" variant="ghost" onPress={() => void reschedule(i, addDaysTo(date, 7))} />
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </Card>
              </FadeIn>
            )
          })
        ) : (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              {DOW.map((d) => (
                <Text key={d} variant="meta" tone="tertiary" style={{ flex: 1, textAlign: 'center' }}>
                  {d}
                </Text>
              ))}
            </View>
            {Array.from({ length: 6 }, (_, w) => (
              <View key={w} style={{ flexDirection: 'row', gap: 4 }}>
                {cells.slice(w * 7, w * 7 + 7).map((date) => {
                  const inMonth = date.slice(0, 7) === anchor.slice(0, 7)
                  const list = derived.itemsOn(date)
                  const doneCount = list.filter((i) => derived.isDone(i, date)).length
                  return (
                    <Pressable
                      key={date}
                      onPress={() => {
                        setAnchor(date)
                        setView('week')
                      }}
                      accessibilityLabel={`${fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length} planned, ${doneCount} done`}
                      style={{
                        flex: 1,
                        minHeight: 52,
                        padding: 4,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: date === today ? colors.controlBg : colors.border,
                        backgroundColor: colors.surface,
                        opacity: inMonth ? 1 : 0.4,
                        gap: 3,
                      }}
                    >
                      <Text variant="meta" style={{ textTransform: 'none', letterSpacing: 0 }}>
                        {Number(date.slice(8, 10))}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                        {list.slice(0, 4).map((i) => (
                          <View key={i.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: derived.isDone(i, date) ? colors.success : colors.textSecondary }} />
                        ))}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

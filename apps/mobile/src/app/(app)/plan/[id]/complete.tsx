import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { listCompletionsForItems, listExecutionItems } from '@tracknow/core/services/executionService'
import { completePlan, getPlan } from '@tracknow/core/services/plansService'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import { buildPlanOutcomeReport, PLAN_KIND_LABEL, planKindOf } from '@tracknow/core/domain/plans'
import { addDays } from '@tracknow/core/domain/streaks'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { Button, Card, EmptyState, LoadingState, Screen, Text, TextField } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

/** Plan completion review: what happened (from records), what you learned, what next. */
export default function CompletePlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [dates, setDates] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState('')
  const [lessons, setLessons] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    ;(async () => {
      try {
        const p = await getPlan(id)
        if (!p) return
        const list = await listExecutionItems(id)
        const today = getTodayDateString()
        const since = p.start_date && p.start_date > addDays(today, -400) ? p.start_date : addDays(today, -400)
        const history = list.length ? await listCompletionsForItems(list.map((i) => i.id), since) : {}
        setPlan(p)
        setItems(list)
        setDates(history)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const report = useMemo(() => (plan ? buildPlanOutcomeReport(plan, items, dates, new Date()) : null), [plan, items, dates])

  const submit = async () => {
    if (busyRef.current || typeof id !== 'string') return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await completePlan(id, { result_notes: result.trim() || null, lessons_learned: lessons.trim() || null, next_decision: next.trim() || null })
      if ((result.trim() || lessons.trim() || next.trim()) && isLegacySchema()) {
        showToast({ id: 'needs-migration', title: 'Plan completed', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
      } else {
        showToast({ title: 'Plan completed', message: 'Its history is kept. Start the next Arc whenever you are ready.', type: 'success' })
      }
      router.replace(`/plan/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the plan')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Complete plan" />
        <LoadingState />
      </Screen>
    )
  }
  if (!plan || !report) {
    return (
      <Screen scroll={false}>
        <AppBar title="Complete plan" />
        <EmptyState title="Plan not found" action={{ label: 'Go back', onPress: () => router.back() }} />
      </Screen>
    )
  }

  const kind = PLAN_KIND_LABEL[planKindOf(plan)]
  return (
    <Screen>
      <AppBar title={`Complete ${kind}`} />
      <View style={{ gap: spacing[4] }}>
        <View style={{ gap: 4 }}>
          <Text variant="h2">{plan.name}</Text>
          <Text variant="caption" tone="secondary">
            Nothing is deleted: items and history stay. The {kind} simply moves to Completed.
          </Text>
        </View>

        <Card style={{ gap: spacing[2] }}>
          <Text variant="h3">What the records say</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {[
              [`${report.milestones.done}/${report.milestones.total}`, 'milestones'],
              [`${report.tasks.done}/${report.tasks.total}`, 'tasks'],
              [report.habitConsistency === null ? '—' : `${report.habitConsistency}%`, 'habit consistency'],
              [String(report.completions), 'completions'],
              [String(report.activeDays), 'active days'],
            ].map(([v, l]) => (
              <View key={l} style={{ minWidth: 90 }}>
                <Text variant="h3">{v}</Text>
                <Text variant="meta" tone="tertiary">
                  {l}
                </Text>
              </View>
            ))}
          </View>
          {report.habits.length > 0 ? (
            <View style={{ gap: 2, marginTop: spacing[1] }}>
              {report.habits.map((h) => (
                <Text key={h.name} variant="caption" tone="secondary">
                  {h.name}: {h.consistency}% · best {h.longestStreak} {h.unit}
                </Text>
              ))}
            </View>
          ) : null}
          {plan.outcome ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing[1] }}>
              You set out to: {plan.outcome}
            </Text>
          ) : null}
        </Card>

        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}

        <TextField label="What happened? (optional)" value={result} onChangeText={setResult} placeholder="The result, in a few lines" multiline numberOfLines={3} maxLength={4000} style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <TextField label="What did you learn? (optional)" value={lessons} onChangeText={setLessons} placeholder="What worked, what got in the way" multiline numberOfLines={3} maxLength={4000} style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <TextField label="What next? (optional)" value={next} onChangeText={setNext} placeholder="Continue, change or stop — and why" multiline numberOfLines={2} maxLength={2000} style={{ minHeight: 64, textAlignVertical: 'top' }} />

        <Button title={busy ? 'Completing…' : `Complete ${kind}`} block loading={busy} onPress={submit} />
        <Button title="Cancel" variant="ghost" block onPress={() => router.back()} />
      </View>
    </Screen>
  )
}

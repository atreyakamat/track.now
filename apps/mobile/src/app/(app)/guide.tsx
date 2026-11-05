import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { createExecutionItem } from '@tracknow/core/services/executionService'
import { createPlan } from '@tracknow/core/services/plansService'
import { createTrack } from '@tracknow/core/services/tracksService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import {
  GOAL_TEMPLATES,
  buildGoalItemInput,
  getGoalTemplate,
  type GoalItemTemplate,
  type GoalTemplate,
} from '@tracknow/core/constants/goalTemplates'
import { AppBar } from '@/components/AppBar'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import { Badge, Button, Card, Screen, Text, TextField } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, resolveTrackColor, spacing } from '@/theme/tokens'

function cadenceLabel(item: GoalItemTemplate): string {
  if (item.type === 'task') return 'Task'
  if (item.type === 'milestone') return 'Milestone'
  if (item.type !== 'habit' || !item.cadence) return item.type
  const { days_of_week, time_of_day } = item.cadence
  const days =
    !days_of_week || days_of_week.length === 7
      ? 'Daily'
      : days_of_week.length === 5 && !days_of_week.includes(0) && !days_of_week.includes(6)
        ? 'Weekdays'
        : `${days_of_week.length}×/week`
  const tod = time_of_day && time_of_day !== 'anytime' ? ` · ${time_of_day}` : ''
  const target = item.target_count && item.target_count > 1 ? ` · ${item.target_count} ${item.unit ?? ''}`.trimEnd() : ''
  return `${days}${tod}${target}`
}

export default function GuidedPlannerScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [trackName, setTrackName] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const goal = useMemo(() => (selectedKey ? getGoalTemplate(selectedKey) : undefined), [selectedKey])

  const chooseGoal = (g: GoalTemplate) => {
    setSelectedKey(g.key)
    setTrackName(g.track.name)
    setExcluded(new Set())
    setError(null)
  }

  const toggleItem = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const back = () => {
    if (goal) {
      setSelectedKey(null)
      setError(null)
    } else {
      router.back()
    }
  }

  const create = async () => {
    if (!user || !goal || busyRef.current) return
    const name = trackName.trim()
    if (!name) {
      setError('Give your track a name.')
      return
    }
    const chosen = goal.items.filter((it) => !excluded.has(it.key))
    if (chosen.length === 0) {
      setError('Keep at least one habit, task or milestone.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const track = await createTrack(user.id, {
        name,
        description: goal.track.description,
        template_key: null,
        template_type: goal.category,
        icon: goal.icon,
        color: goal.color,
      })
      const plan = await createPlan(user.id, {
        track_id: track.id,
        name: goal.plan.name,
        description: goal.plan.description,
        start_date: getTodayDateString(),
        end_date: null,
      })
      let failed = 0
      for (const item of chosen) {
        try {
          await createExecutionItem(user.id, buildGoalItemInput(item, { planId: plan.id, trackId: track.id }))
        } catch {
          failed += 1
        }
      }
      if (failed > 0) {
        showToast({
          title: 'Plan created with some gaps',
          message: `${failed} item${failed === 1 ? '' : 's'} couldn’t be added — you can add ${failed === 1 ? 'it' : 'them'} manually.`,
          type: 'warning',
        })
      } else {
        showToast({ title: 'Your plan is ready', type: 'success' })
      }
      router.replace(`/track/${track.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your plan. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // ---- Step 1: pick a goal ----
  if (!goal) {
    return (
      <Screen scroll padded={false}>
        <View style={{ paddingHorizontal: spacing[4] }}>
          <AppBar title="Plan a goal" onBack={back} />
        </View>
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[4], paddingBottom: spacing[7] }}>
          <Text variant="caption" tone="secondary">
            Pick what you want to achieve. We’ll set up a track with habits, tasks and a milestone — you can tweak everything before it’s created.
          </Text>
          <View style={{ gap: spacing[3] }}>
            {GOAL_TEMPLATES.map((g) => (
              <Pressable key={g.key} onPress={() => chooseGoal(g)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                  <TrackIcon icon={g.icon} color={g.color} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="caption" weight="semibold">
                      {g.goal}
                    </Text>
                    <Text variant="meta" tone="secondary">
                      {g.summary}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textTertiary} />
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </Screen>
    )
  }

  // ---- Step 2: review & tweak ----
  const includedCount = goal.items.filter((it) => !excluded.has(it.key)).length

  return (
    <Screen scroll padded={false}>
      <View style={{ paddingHorizontal: spacing[4] }}>
        <AppBar title="Review your plan" onBack={back} />
      </View>
      <View style={{ paddingHorizontal: spacing[4], gap: spacing[4], paddingBottom: spacing[7] }}>
        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <TrackIcon icon={goal.icon} color={goal.color} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="meta" tone="tertiary">
              {goal.goal}
            </Text>
            <Text variant="caption" tone="secondary">
              {goal.plan.name}
            </Text>
          </View>
        </View>

        <TextField label="Track name" value={trackName} onChangeText={setTrackName} placeholder="Track name" maxLength={80} />

        <View style={{ gap: spacing[2] }}>
          <Text variant="meta" tone="tertiary">
            What you’ll track ({includedCount}/{goal.items.length})
          </Text>
          <Text variant="meta" tone="tertiary">
            Tap any item to leave it out.
          </Text>
          <View style={{ gap: spacing[2] }}>
            {goal.items.map((item) => {
              const included = !excluded.has(item.key)
              return (
                <Pressable key={item.key} onPress={() => toggleItem(item.key)}>
                  <Card
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      opacity: included ? 1 : 0.5,
                      borderColor: included ? resolveTrackColor(goal.color) : colors.borderStrong,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.borderStrong,
                        backgroundColor: included ? colors.controlBg : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {included ? <Feather name="check" size={16} color={colors.controlText} /> : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption" weight="medium">
                        {item.name}
                      </Text>
                      <Text variant="meta" tone="tertiary">
                        {cadenceLabel(item)}
                      </Text>
                    </View>
                    <Badge label={item.type} />
                  </Card>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Button
          title={busy ? 'Creating your plan…' : 'Create my plan'}
          block
          loading={busy}
          onPress={create}
        />
        <Text variant="meta" tone="tertiary" center>
          Creates a track, a plan and {includedCount} item{includedCount === 1 ? '' : 's'}. You can edit or add more anytime.
        </Text>
      </View>
    </Screen>
  )
}

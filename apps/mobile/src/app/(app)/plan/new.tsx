import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { createPlan } from '@tracknow/core/services/plansService'
import { getTrack } from '@tracknow/core/services/tracksService'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { ARC_DURATION_PRESETS, arcEndDate } from '@tracknow/core/domain/plans'
import type { PlanKind, Track } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { ArcField, OutcomeFields } from '@/components/plans/PlanFields'
import { Button, Card, ChoiceChips, DateField, EmptyState, LoadingState, Screen, Text, TextField } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRESETS = [7, 30, 60, 90, 180] as const
type DurationChoice = (typeof PRESETS)[number] | 'custom'

export default function NewPlanScreen() {
  const { trackId, kind: kindParam, arc: arcParam } = useLocalSearchParams<{ trackId: string; kind?: string; arc?: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()

  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [kind, setKind] = useState<PlanKind>(kindParam === 'ongoing' ? 'ongoing' : 'time_bound')
  const [days, setDays] = useState<DurationChoice>(90)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<string | null>(getTodayDateString())
  const [customEnd, setCustomEnd] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [criteria, setCriteria] = useState('')
  const [arcName, setArcName] = useState(typeof arcParam === 'string' ? arcParam : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const endDate = kind === 'ongoing' ? null : days === 'custom' ? customEnd : startDate ? arcEndDate(startDate, days) : null

  useEffect(() => {
    if (typeof trackId !== 'string' || !RECORD_ID_RE.test(trackId)) {
      setMissing(true)
      setLoading(false)
      return
    }
    getTrack(trackId)
      .then((t) => {
        setTrack(t)
        setMissing(!t)
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [trackId])

  const submit = async () => {
    if (busyRef.current || !track || typeof trackId !== 'string' || !user) return
    if (!name.trim()) return setError('Plan name is required.')
    if (name.trim().length > 120) return setError('Plan name must be 120 characters or fewer.')
    if (kind === 'time_bound' && !endDate) return setError(startDate ? 'Choose when this Arc ends.' : 'An Arc needs a start date.')
    if (startDate && endDate && endDate < startDate) return setError('The target end date cannot be before the start date.')
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const plan = await createPlan(user.id, {
        track_id: trackId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        plan_kind: kind,
        outcome: outcome.trim() || null,
        success_criteria: criteria.trim() || null,
        arc_name: arcName.trim() || null,
      })
      if ((outcome.trim() || criteria.trim() || arcName.trim()) && isLegacySchema()) {
        showToast({ id: 'needs-migration', title: 'Plan created', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
      }
      router.replace(`/plan/${plan.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="New plan" />
        <LoadingState label="Loading track…" />
      </Screen>
    )
  }

  if (missing) {
    return (
      <Screen scroll={false}>
        <AppBar title="New plan" />
        <EmptyState
          icon={<Feather name="search" size={22} color={colors.textSecondary} />}
          title="Track not found"
          description="It may have been deleted, or you may not have access, so a plan cannot be added here."
          action={{ label: 'Back to tracks', onPress: () => router.replace('/(app)/(tabs)/tracks') }}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar title={`New plan in ${track?.name ?? ''}`} />
      <View style={{ gap: spacing[4] }}>
        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}

        <ChoiceChips
          label="Kind"
          options={[
            { value: 'time_bound', label: 'Arc (has an end date)' },
            { value: 'ongoing', label: 'Ongoing (no end date)' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as PlanKind)}
        />
        <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {kind === 'time_bound' ? 'A focused push with a start and an end: 30, 60 or 90 days. It is reviewed when it ends.' : 'Routines and standing responsibilities. They never expire.'}
        </Text>

        <TextField label="Name" value={name} onChangeText={setName} placeholder={kind === 'time_bound' ? 'e.g. Winter Arc · Fitness' : 'e.g. Household routine'} maxLength={120} />
        <TextField
          label="Purpose (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What does this plan cover?"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <DateField label="Start date" value={startDate} onChange={setStartDate} clearable />
        {kind === 'time_bound' ? (
          <>
            <ChoiceChips
              label="Length"
              options={[...PRESETS.map((d) => ({ value: d as DurationChoice, label: `${d} days` })), { value: 'custom' as DurationChoice, label: 'Custom' }]}
              value={days}
              onChange={setDays}
            />
            {days === 'custom' ? (
              <DateField label="End date" value={customEnd} onChange={setCustomEnd} placeholder="Choose the end date" />
            ) : endDate ? (
              <Text variant="caption" tone="secondary">
                Ends {new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </>
        ) : null}

        <ArcField value={arcName} onChange={setArcName} />
        <OutcomeFields outcome={outcome} criteria={criteria} onOutcome={setOutcome} onCriteria={setCriteria} />

        <Button title={busy ? 'Creating…' : 'Create plan'} block loading={busy} onPress={submit} />
      </View>
    </Screen>
  )
}

export { ARC_DURATION_PRESETS }

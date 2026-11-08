import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { getPlan, updatePlan } from '@tracknow/core/services/plansService'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import { planKindOf } from '@tracknow/core/domain/plans'
import type { PlanKind } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { ArcField, OutcomeFields } from '@/components/plans/PlanFields'
import { Button, Card, ChoiceChips, DateField, EmptyState, LoadingState, Screen, Text, TextField } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<PlanKind>('time_bound')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [criteria, setCriteria] = useState('')
  const [arcName, setArcName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    getPlan(id)
      .then((plan) => {
        if (!plan) {
          setMissing(true)
          return
        }
        setName(plan.name)
        setDescription(plan.description ?? '')
        setKind(planKindOf(plan))
        setStartDate(plan.start_date)
        setEndDate(plan.end_date)
        setOutcome(plan.outcome ?? '')
        setCriteria(plan.success_criteria ?? '')
        setArcName(plan.arc_name ?? '')
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [id])

  const save = async () => {
    if (busyRef.current || typeof id !== 'string') return
    if (!name.trim()) return setError('Plan name is required.')
    if (name.trim().length > 120) return setError('Plan name must be 120 characters or fewer.')
    if (kind === 'time_bound' && !endDate) return setError('An Arc needs an end date. Choose “Ongoing” for no end date.')
    if (startDate && endDate && kind === 'time_bound' && endDate < startDate) return setError('The end date cannot be before the start date.')
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await updatePlan(id, {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: kind === 'ongoing' ? null : endDate,
        plan_kind: kind,
        outcome,
        success_criteria: criteria,
        arc_name: arcName,
      })
      if ((outcome.trim() || criteria.trim() || arcName.trim()) && isLegacySchema()) {
        showToast({ id: 'needs-migration', title: 'Plan saved', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
      }
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Edit plan" />
        <LoadingState />
      </Screen>
    )
  }

  if (missing) {
    return (
      <Screen scroll={false}>
        <AppBar title="Edit plan" />
        <EmptyState title="Plan not found" description="It may have been deleted." action={{ label: 'Go back', onPress: () => router.back() }} />
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar title="Edit plan" />
      <View style={{ gap: spacing[4] }}>
        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}
        <TextField label="Name" value={name} onChangeText={setName} maxLength={120} />
        <TextField label="Purpose (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <ChoiceChips
          label="Kind"
          options={[
            { value: 'time_bound', label: 'Arc (has an end date)' },
            { value: 'ongoing', label: 'Ongoing (no end date)' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as PlanKind)}
        />
        <DateField label="Start date" value={startDate} onChange={setStartDate} clearable />
        {kind === 'time_bound' ? <DateField label="End date" value={endDate} onChange={setEndDate} placeholder="Choose the end date" /> : null}
        <ArcField value={arcName} onChange={setArcName} />
        <OutcomeFields outcome={outcome} criteria={criteria} onOutcome={setOutcome} onCriteria={setCriteria} />
        <Button title={busy ? 'Saving…' : 'Save changes'} block loading={busy} onPress={save} />
      </View>
    </Screen>
  )
}

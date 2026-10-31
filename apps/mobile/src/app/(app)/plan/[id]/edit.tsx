import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { getPlan, updatePlan } from '@tracknow/core/services/plansService'
import { AppBar } from '@/components/AppBar'
import { Button, Card, DateField, EmptyState, LoadingState, Screen, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useTheme()
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
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
        setStartDate(plan.start_date)
        setEndDate(plan.end_date)
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [id])

  const save = async () => {
    if (busyRef.current || typeof id !== 'string') return
    if (!name.trim()) {
      setError('Plan name is required.')
      return
    }
    if (name.trim().length > 120) {
      setError('Plan name must be 120 characters or fewer.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('The target end date cannot be before the start date.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await updatePlan(id, {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
      })
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
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <DateField label="Start date" value={startDate} onChange={setStartDate} clearable />
        <DateField label="Target end date" value={endDate} onChange={setEndDate} clearable placeholder="No end date" />
        <Button title={busy ? 'Saving…' : 'Save changes'} block loading={busy} onPress={save} />
      </View>
    </Screen>
  )
}

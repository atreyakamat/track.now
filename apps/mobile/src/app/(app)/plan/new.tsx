import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { createPlan } from '@tracknow/core/services/plansService'
import { getTrack } from '@tracknow/core/services/tracksService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import type { Track } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import {
  Button,
  Card,
  DateField,
  EmptyState,
  LoadingState,
  Screen,
  Text,
  TextField,
} from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function NewPlanScreen() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>()
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<string | null>(getTodayDateString())
  const [endDate, setEndDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

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
      const plan = await createPlan(user.id, {
        track_id: trackId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
      })
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

        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Q1 Marathon Prep" maxLength={120} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What does this plan cover?"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <DateField label="Start date" value={startDate} onChange={setStartDate} clearable />
        <DateField label="Target end date" value={endDate} onChange={setEndDate} clearable placeholder="No end date" />

        <Button title={busy ? 'Creating…' : 'Create plan'} block loading={busy} onPress={submit} />
      </View>
    </Screen>
  )
}

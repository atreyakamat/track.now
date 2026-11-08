import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { editExecutionItem, getExecutionItem } from '@tracknow/core/services/executionService'
import { getReminderForItem, setReminderForItem } from '@tracknow/core/services/reminderService'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import type { TimeOfDayChoice } from '@tracknow/core/domain/habitSchedule'
import { AppBar } from '@/components/AppBar'
import { ItemForm, repeatChoiceOf, type ItemFormInitial } from '@/components/execution/ItemForm'
import { EmptyState, LoadingState, Screen } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'

function toInitial(item: ExecutionItem): ItemFormInitial {
  const sched = item.schedule
  const tod = (sched?.time_of_day ?? 'anytime') as TimeOfDayChoice
  return {
    type: item.type,
    name: item.name,
    description: item.description ?? '',
    priority: item.priority,
    dueDate: item.due_date,
    startDate: item.start_date ?? null,
    target: item.target_count ?? 1,
    unit: item.unit ?? '',
    repeat: repeatChoiceOf(sched),
    daysOfWeek: sched?.days_of_week ?? [1, 2, 3, 4, 5],
    timesPerWeek: sched?.times_per_week ?? 3,
    timeOfDay: ['anytime', 'morning', 'afternoon', 'evening'].includes(tod) ? tod : 'anytime',
    habitTime: sched?.reminder_time ?? '',
    steps: item.checklist_entries ?? [],
    originalSchedule: sched ? { frequency: sched.frequency, days_of_week: sched.days_of_week } : null,
  }
}

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<ExecutionItem | null>(null)
  const [reminderPreset, setReminderPreset] = useState<ItemFormInitial['reminderPreset']>('none')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    getExecutionItem(id)
      .then((loaded) => {
        setItem(loaded)
        if (loaded && user) setReminderPreset(getReminderForItem(user.id, loaded.id)?.preset ?? 'none')
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [id, user?.id])

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Edit item" />
        <LoadingState />
      </Screen>
    )
  }

  if (!item) {
    return (
      <Screen scroll={false}>
        <AppBar title="Edit item" />
        <EmptyState title="Item not found" description="It may have been deleted." action={{ label: 'Go back', onPress: () => router.back() }} />
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar title="Edit item" />
      <ItemForm
        initial={{ ...toInitial(item), reminderPreset }}
        submitLabel={busy ? 'Saving…' : 'Save changes'}
        busy={busy}
        onSubmit={async ({ base, reminderPreset: nextPreset }) => {
          if (!user || typeof id !== 'string' || busy) return
          setBusy(true)
          try {
            const updated = await editExecutionItem(id, base, user.id)
            if ((base.start_date || base.checklist_entries?.length || base.schedule?.times_per_week) && isLegacySchema()) {
              showToast({ id: 'needs-migration', title: 'Saved with fewer details', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
            }
            try {
              setReminderForItem(user.id, updated, nextPreset)
            } catch (remErr) {
              showToast({
                title: 'Saved, reminder not set',
                message: remErr instanceof Error ? remErr.message : 'Could not schedule the reminder.',
                type: 'warning',
              })
            }
            router.back()
          } catch (err) {
            showToast({ title: 'Could not save item', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
            setBusy(false)
          }
        }}
      />
    </Screen>
  )
}

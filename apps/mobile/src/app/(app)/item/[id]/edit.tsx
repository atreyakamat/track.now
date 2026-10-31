import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { editExecutionItem, getExecutionItem } from '@tracknow/core/services/executionService'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import type { HabitFrequency, TimeOfDayChoice } from '@tracknow/core/domain/habitSchedule'
import { AppBar } from '@/components/AppBar'
import { ItemForm, type ItemFormInitial } from '@/components/execution/ItemForm'
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
    target: item.target_count ?? 1,
    unit: item.unit ?? '',
    frequency: (sched?.frequency ?? 'daily') as HabitFrequency,
    daysOfWeek: sched?.days_of_week ?? [1, 2, 3, 4, 5],
    timeOfDay: ['anytime', 'morning', 'afternoon', 'evening'].includes(tod) ? tod : 'anytime',
    habitTime: sched?.reminder_time ?? '',
    originalSchedule: sched ? { frequency: sched.frequency, days_of_week: sched.days_of_week } : null,
  }
}

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<ExecutionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    getExecutionItem(id)
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [id])

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
        initial={toInitial(item)}
        submitLabel={busy ? 'Saving…' : 'Save changes'}
        busy={busy}
        onSubmit={async ({ base }) => {
          if (!user || typeof id !== 'string' || busy) return
          setBusy(true)
          try {
            await editExecutionItem(id, base, user.id)
            router.back()
          } catch (err) {
            showToast({
              title: 'Could not save item',
              message: err instanceof Error ? err.message : 'Please try again.',
              type: 'warning',
            })
            setBusy(false)
          }
        }}
      />
    </Screen>
  )
}

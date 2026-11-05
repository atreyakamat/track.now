import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { createExecutionItem } from '@tracknow/core/services/executionService'
import { setReminderForItem } from '@tracknow/core/services/reminderService'
import type { ItemType } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { defaultItemForm, ItemForm } from '@/components/execution/ItemForm'
import { Screen } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'

const TYPES: ItemType[] = ['task', 'habit', 'checklist', 'milestone', 'project']

export default function NewItemScreen() {
  const { planId, trackId, type } = useLocalSearchParams<{ planId: string; trackId?: string; type?: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const initialType = (typeof type === 'string' && (TYPES as string[]).includes(type) ? type : 'task') as ItemType

  return (
    <Screen>
      <AppBar title="New item" />
      <ItemForm
        initial={defaultItemForm(initialType)}
        submitLabel={busy ? 'Adding…' : 'Add item'}
        busy={busy}
        onSubmit={async ({ base, reminderPreset }) => {
          if (!user || typeof planId !== 'string' || busy) return
          setBusy(true)
          try {
            const created = await createExecutionItem(user.id, {
              ...base,
              plan_id: planId,
              track_id: typeof trackId === 'string' ? trackId : undefined,
            })
            if (reminderPreset !== 'none') {
              try {
                setReminderForItem(user.id, created, reminderPreset)
              } catch (remErr) {
                showToast({
                  title: 'Item added, reminder not set',
                  message: remErr instanceof Error ? remErr.message : 'Could not schedule the reminder.',
                  type: 'warning',
                })
              }
            }
            router.back()
          } catch (err) {
            showToast({
              title: 'Could not add item',
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

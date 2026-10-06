import { useState } from 'react'
import type { ItemPriority, ItemType, NewExecutionItemInput } from '@/types/domain'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'

interface CreateItemModalProps {
  open: boolean
  onClose: () => void
  planId: string
  trackId: string
  defaultType?: ItemType
  onSubmit: (input: NewExecutionItemInput) => Promise<void>
}

export function CreateItemModal({
  open,
  onClose,
  planId,
  trackId,
  defaultType = 'task',
  onSubmit,
}: CreateItemModalProps) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Item name is required.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      await onSubmit({
        plan_id: planId,
        track_id: trackId,
        type,
        name: name.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
      })
      setName('')
      setDescription('')
      setDueDate('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Execution Item"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Adding…' : 'Add Item'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form" style={{ gap: 'var(--space-3)' }}>
        {error && <div className="alert alert--error">{error}</div>}

        <Select
          label="Item Type"
          value={type}
          onChange={(e) => setType(e.target.value as ItemType)}
          hint="Habit, Task, Checklist item, Project, or Milestone"
        >
          <option value="task">Task (Action to be done)</option>
          <option value="habit">Habit (Recurring routine)</option>
          <option value="checklist">Checklist Item (Quick verification)</option>
          <option value="milestone">Milestone (Key target/marker)</option>
          <option value="project">Project (Initiative with sub-steps)</option>
        </Select>

        <Input
          label="Title"
          placeholder="e.g. 5km morning run, complete portfolio draft"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description (Optional)"
          placeholder="Add context, parameters, or details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as ItemPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>

          <Input
            label="Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}

import { Calendar, Check, Trash2 } from 'lucide-react'
import type { ExecutionItem } from '@/types/domain'
import { Badge, Button } from '@/components/ui'
import { isOverdue } from '@/domain/dates'

interface ExecutionItemCardProps {
  item: ExecutionItem
  onToggleStatus: (itemId: string, currentStatus: ExecutionItem['status']) => void
  onDelete?: (itemId: string) => void
  busy?: boolean
}

export function ExecutionItemCard({
  item,
  onToggleStatus,
  onDelete,
  busy,
}: ExecutionItemCardProps) {
  const isDone = item.status === 'done'
  const overdue = !isDone && isOverdue(item.due_date)

  const priorityColor =
    item.priority === 'high'
      ? 'var(--danger)'
      : item.priority === 'low'
      ? 'var(--text-tertiary)'
      : 'var(--text-secondary)'

  return (
    <div
      className={`card ${isDone ? 'card--muted' : ''}`}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <button
        type="button"
        className="btn btn--icon btn--sm"
        style={{
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          minHeight: '28px',
          padding: 0,
          background: isDone ? 'var(--control-bg)' : 'transparent',
          color: isDone ? 'var(--control-text)' : 'transparent',
          border: '2px solid',
          borderColor: isDone ? 'var(--control-bg)' : 'var(--border-strong)',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
        onClick={() => onToggleStatus(item.id, item.status)}
        disabled={busy}
        aria-label={isDone ? `Mark ${item.name} as incomplete` : `Mark ${item.name} as done`}
      >
        <Check size={14} style={{ opacity: isDone ? 1 : 0 }} />
      </button>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            className="t-h3"
            style={{
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
          >
            {item.name}
          </span>
          <Badge>{item.type}</Badge>
          {item.priority !== 'medium' && (
            <span
              className="t-meta"
              style={{ color: priorityColor, fontWeight: 600 }}
              title={`Priority: ${item.priority}`}
            >
              {item.priority}
            </span>
          )}
        </div>

        {item.description && (
          <p
            className="card__desc"
            style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--text-secondary)',
            }}
          >
            {item.description}
          </p>
        )}

        {item.due_date && (
          <div
            className="row"
            style={{
              gap: '4px',
              fontSize: 'var(--text-meta)',
              color: overdue ? 'var(--danger)' : 'var(--text-secondary)',
              fontWeight: overdue ? 600 : 400,
            }}
          >
            <Calendar size={12} />
            <span>
              {item.due_date} {overdue ? '(Overdue)' : ''}
            </span>
          </div>
        )}
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id)}
          disabled={busy}
          title="Delete item"
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  )
}

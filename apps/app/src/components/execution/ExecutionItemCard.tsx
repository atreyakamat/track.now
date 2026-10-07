import { Calendar, Check, Edit2, Repeat, Trash2 } from 'lucide-react'
import type { ExecutionItem } from '@/types/domain'
import { Badge, Button } from '@/components/ui'
import { isOverdue } from '@/domain/dates'

interface ExecutionItemCardProps {
  item: ExecutionItem
  onToggleStatus: (itemId: string, currentStatus: ExecutionItem['status']) => void
  onUpdateCount?: (itemId: string, newCount: number) => void
  onEdit?: (item: ExecutionItem) => void
  onDelete?: (itemId: string) => void
  busy?: boolean
  isCompletedOverride?: boolean
}

export function ExecutionItemCard({
  item,
  onToggleStatus,
  onUpdateCount,
  onEdit,
  onDelete,
  busy,
  isCompletedOverride,
}: ExecutionItemCardProps) {
  const isDone = isCompletedOverride !== undefined ? isCompletedOverride : item.status === 'done'
  const overdue = !isDone && isOverdue(item.due_date)
  const targetCount = Math.max(1, item.target_count ?? 1)
  const currentCount = Math.max(0, item.current_count ?? 0)
  const hasNumericTarget = targetCount > 1 || Boolean(item.unit)
  const progressPercent = Math.min(100, Math.round((currentCount / targetCount) * 100))

  const priorityColor =
    item.priority === 'urgent'
      ? '#ef4444'
      : item.priority === 'high'
      ? 'var(--warning, #e67e22)'
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
        flexWrap: 'wrap',
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

      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
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

        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
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

          {item.schedule && (
            <div
              className="row"
              style={{
                gap: '4px',
                fontSize: 'var(--text-meta)',
                color: 'var(--text-secondary)',
              }}
            >
              <Repeat size={12} />
              <span style={{ textTransform: 'capitalize' }}>
                {item.schedule.frequency}
                {item.schedule.time_of_day && item.schedule.time_of_day !== 'anytime'
                  ? ` · ${item.schedule.time_of_day}`
                  : ''}
              </span>
            </div>
          )}
        </div>

        {hasNumericTarget && (
          <div
            style={{
              marginTop: '4px',
              maxWidth: '180px',
              height: '3px',
              background: 'var(--surface-muted)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isDone ? 'var(--success, #22c55e)' : 'var(--control-bg)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        )}
      </div>

      {hasNumericTarget && (
        <div
          className="row"
          style={{
            alignItems: 'center',
            gap: '4px',
            background: 'var(--surface-muted)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{
              padding: 0,
              width: '24px',
              minHeight: '24px',
              height: '24px',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: 1,
            }}
            onClick={() => onUpdateCount?.(item.id, Math.max(0, currentCount - 1))}
            disabled={busy || currentCount <= 0 || !onUpdateCount}
            aria-label={`Decrease ${item.name} count`}
          >
            –
          </button>
          <span
            style={{
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              minWidth: '40px',
              textAlign: 'center',
            }}
          >
            {currentCount} / {targetCount} {item.unit || ''}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{
              padding: 0,
              width: '24px',
              minHeight: '24px',
              height: '24px',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: 1,
            }}
            onClick={() => onUpdateCount?.(item.id, currentCount + 1)}
            disabled={busy || !onUpdateCount}
            aria-label={`Increase ${item.name} count`}
          >
            +
          </button>
        </div>
      )}

      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          disabled={busy}
          title="Edit item"
          aria-label={`Edit ${item.name}`}
        >
          <Edit2 size={14} />
        </Button>
      )}

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

import { useEffect, useState } from 'react'
import { Bell, Calendar, Check, Clock, Edit2, Flame, Repeat, Trash2 } from 'lucide-react'
import type { ExecutionItem } from '@/types/domain'
import { Badge, Button } from '@/components/ui'
import { isOverdue } from '@/domain/dates'
import { effectiveCurrentCount } from '@/domain/habitCounter'
import type { HabitStreakSummary } from '@/domain/streaks'
import {
  cancelReminderForItem,
  formatReminderLabel,
  getReminderForItem,
  snoozeReminder,
} from '@/services/reminderService'

interface ExecutionItemCardProps {
  item: ExecutionItem
  onToggleStatus: (itemId: string, currentStatus: ExecutionItem['status']) => void
  onUpdateCount?: (itemId: string, newCount: number) => void
  onStepCount?: (itemId: string, delta: number) => void
  onEdit?: (item: ExecutionItem) => void
  onDelete?: (itemId: string) => void
  onSnoozeReminder?: (itemId: string, minutes?: number) => void
  onRemoveReminder?: (itemId: string) => void
  busy?: boolean
  isCompletedOverride?: boolean
  streakSummary?: HabitStreakSummary | null
}

export function ExecutionItemCard({
  item,
  onToggleStatus,
  onUpdateCount,
  onStepCount,
  onEdit,
  onDelete,
  onSnoozeReminder,
  onRemoveReminder,
  busy,
  isCompletedOverride,
  streakSummary,
}: ExecutionItemCardProps) {
  const isDone = isCompletedOverride !== undefined ? isCompletedOverride : item.status === 'done'
  // Habits recur on their schedule; a stale due date never makes a habit overdue.
  const overdue = item.type !== 'habit' && !isDone && isOverdue(item.due_date)
  const targetCount = Math.max(1, item.target_count ?? 1)
  // A habit's stored count may belong to an earlier day (see domain/habitCounter.ts).
  const currentCount = effectiveCurrentCount(item, isDone)
  const hasNumericTarget = targetCount > 1 || Boolean(item.unit)
  const progressPercent = Math.min(100, Math.round((currentCount / targetCount) * 100))

  const [, setReminderRev] = useState(0)
  useEffect(() => {
    const handleUpdate = () => setReminderRev((v) => v + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('tracknow:reminders-updated', handleUpdate)
      window.addEventListener('tracknow:reminder-fired', handleUpdate)
      return () => {
        window.removeEventListener('tracknow:reminders-updated', handleUpdate)
        window.removeEventListener('tracknow:reminder-fired', handleUpdate)
      }
    }
  }, [])

  const activeReminder =
    item.user_id && !isDone
      ? getReminderForItem(item.user_id, item.id)
      : null

  const priorityColor =
    item.priority === 'urgent'
      ? 'var(--danger)'
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
          width: '36px',
          minWidth: '36px',
          height: '36px',
          minHeight: '36px',
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
        aria-pressed={isDone}
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
          {item.type === 'habit' && streakSummary && (
            <div
              className="row"
              title={`Current Streak: ${streakSummary.currentStreak} day${streakSummary.currentStreak === 1 ? '' : 's'} · Best: ${streakSummary.longestStreak} · Consistency: ${streakSummary.consistencyRate}%`}
              style={{
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                color: streakSummary.isActiveStreak ? 'var(--accent-primary-text)' : 'var(--text-secondary)',
                background: streakSummary.isActiveStreak ? 'var(--accent-primary)' : 'var(--surface-muted)',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid ' + (streakSummary.isActiveStreak ? 'rgba(200, 241, 105, 0.3)' : 'transparent'),
              }}
            >
              <Flame size={12} fill={streakSummary.isActiveStreak ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{streakSummary.currentStreak}d streak</span>
              <span className="sr-only">{`, best ${streakSummary.longestStreak} days, ${streakSummary.consistencyRate}% consistency`}</span>
            </div>
          )}
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

          {activeReminder && (
            <div
              className="row"
              title={`Smart reminder: ${new Date(activeReminder.remindAt).toLocaleString()} (${activeReminder.preset})`}
              style={{
                alignItems: 'center',
                gap: '4px',
                background:
                  activeReminder.status === 'snoozed'
                    ? 'rgba(230, 126, 34, 0.12)'
                    : 'var(--surface-muted)',
                padding: '2px 8px',
                borderRadius: '999px',
                border:
                  '1px solid ' +
                  (activeReminder.status === 'snoozed'
                    ? 'rgba(230, 126, 34, 0.3)'
                    : 'var(--border)'),
                fontSize: 'var(--text-meta)',
              }}
            >
              <Bell
                size={12}
                style={{
                  color:
                    activeReminder.status === 'snoozed'
                      ? 'var(--warning, #e67e22)'
                      : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              />
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 4px',
                  minHeight: '32px',
                  cursor: 'pointer',
                  color:
                    activeReminder.status === 'snoozed'
                      ? 'var(--warning, #e67e22)'
                      : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: 'inherit',
                }}
                onClick={() => onEdit?.(item)}
                title="Click to edit reminder"
                aria-label={`Edit reminder for ${item.name}`}
              >
                {formatReminderLabel(activeReminder)}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{
                  padding: '0 8px',
                  minHeight: '32px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onSnoozeReminder) {
                    onSnoozeReminder(item.id, 10)
                  } else if (item.user_id) {
                    snoozeReminder(item.user_id, activeReminder.id, 10)
                  }
                }}
                title="Snooze reminder by 10 minutes"
                aria-label={`Snooze reminder for ${item.name} by 10 minutes`}
              >
                +10m
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{
                  padding: '0 8px',
                  minHeight: '32px',
                  minWidth: '32px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onRemoveReminder) {
                    onRemoveReminder(item.id)
                  } else if (item.user_id) {
                    cancelReminderForItem(item.user_id, item.id)
                  }
                }}
                title="Remove reminder"
                aria-label={`Remove reminder for ${item.name}`}
              >
                ×
              </button>
            </div>
          )}

          {item.schedule?.reminder_time && (
            <div
              className="row"
              title={`Scheduled time ${item.schedule.reminder_time.slice(0, 5)}`}
              style={{
                gap: '4px',
                fontSize: 'var(--text-meta)',
                color: 'var(--text-secondary)',
              }}
            >
              <Clock size={12} aria-hidden="true" />
              <span>
                <span className="sr-only">Scheduled time </span>
                {item.schedule.reminder_time.slice(0, 5)}
              </span>
            </div>
          )}

          {!activeReminder && !isDone && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{
                padding: '0 8px',
                minHeight: '32px',
                fontSize: '11px',
                gap: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--text-tertiary)',
              }}
              onClick={() => onEdit?.(item)}
              title="Set a smart reminder for this task"
              aria-label={`Set reminder for ${item.name}`}
            >
              <Bell size={11} />
              <span>Remind</span>
            </button>
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

      <div
        className="execution-card__actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexShrink: 0,
          marginLeft: 'auto',
          flexWrap: 'wrap',
        }}
      >
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
                width: '36px',
                minWidth: '36px',
                minHeight: '36px',
                height: '36px',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: 1,
              }}
              onClick={() =>
                onStepCount
                  ? onStepCount(item.id, -1)
                  : onUpdateCount?.(item.id, Math.max(0, currentCount - 1))
              }
              disabled={busy || currentCount <= 0 || (!onUpdateCount && !onStepCount)}
              aria-label={`Decrease ${item.name} count`}
            >
              –
            </button>
            <span
              aria-live="polite"
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
                width: '36px',
                minWidth: '36px',
                minHeight: '36px',
                height: '36px',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: 1,
              }}
              onClick={() =>
                onStepCount ? onStepCount(item.id, 1) : onUpdateCount?.(item.id, currentCount + 1)
              }
              disabled={busy || (!onUpdateCount && !onStepCount)}
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
    </div>
  )
}

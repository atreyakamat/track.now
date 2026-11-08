import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Calendar, Check, Clock, Edit2, Flame, Hourglass, Repeat, Star, Trash2 } from 'lucide-react'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { checklistProgress } from '@tracknow/core/domain/checklist'
import { DAYS } from '@tracknow/core/domain/habitSchedule'
import { weeklyTarget } from '@tracknow/core/domain/schedule'
import { Badge, Button } from '@/components/ui'
import { isOverdue } from '@tracknow/core/domain/dates'
import { effectiveCurrentCount } from '@tracknow/core/domain/habitCounter'
import type { HabitStreakSummary } from '@tracknow/core/domain/streaks'
import {
  cancelReminderForItem,
  formatReminderLabel,
  getReminderForItem,
  snoozeReminder,
} from '@tracknow/core/services/reminderService'

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
  /** Weekly-target habits: sessions done this week. */
  weekDone?: number
  /** Parent Plan link shown on Today ("Gym routine · Health"). */
  context?: { label: string; to: string } | null
  /** Today focus pin. */
  focused?: boolean
  onToggleFocus?: (item: ExecutionItem) => void
  onToggleChecklistEntry?: (item: ExecutionItem, entryId: string) => void
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** "Daily", "Mon · Wed · Fri", "3× a week" — the schedule in plain words. */
export function scheduleLabel(schedule: ExecutionItem['schedule']): string | null {
  if (!schedule) return null
  const target = weeklyTarget(schedule)
  if (target !== null) return `${target}× a week`
  if (schedule.frequency === 'daily') return 'Daily'
  const days = schedule.days_of_week ?? []
  if ((schedule.frequency === 'weekly' || schedule.frequency === 'custom') && days.length && days.length < 7) {
    return [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => days.includes(d))
      .map((d) => DAYS[d].label)
      .join(' · ')
  }
  return schedule.frequency === 'monthly' ? 'Monthly' : 'Daily'
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
  weekDone,
  context,
  focused,
  onToggleFocus,
  onToggleChecklistEntry,
}: ExecutionItemCardProps) {
  const entries = item.type === 'checklist' ? (item.checklist_entries ?? []) : []
  const steps = checklistProgress(entries)
  const notStarted = Boolean(item.start_date && item.start_date > getTodayDateString())
  const weekTarget = item.type === 'habit' ? weeklyTarget(item.schedule) : null
  const streakUnit = streakSummary?.streakUnit === 'weeks' ? 'w' : 'd'
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
              <span>
                {streakSummary.currentStreak}
                {streakUnit} streak
              </span>
              <span className="sr-only">{`, best ${streakSummary.longestStreak} ${streakUnit === 'w' ? 'weeks' : 'days'}, ${streakSummary.consistencyRate}% consistency`}</span>
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

        {entries.length > 0 && (
          <ul className="checklist" aria-label={`${item.name} steps, ${steps.done} of ${steps.total} done`}>
            {entries.map((e) => (
              <li key={e.id}>
                <label className="checklist__step">
                  <input
                    type="checkbox"
                    checked={e.done}
                    disabled={busy || !onToggleChecklistEntry}
                    onChange={() => onToggleChecklistEntry?.(item, e.id)}
                  />
                  <span className={e.done ? 'checklist__label checklist__label--done' : 'checklist__label'}>{e.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {context && (
            <Link to={context.to} className="t-meta item-context" title="Open the Plan">
              {context.label}
            </Link>
          )}
          {notStarted && item.start_date && (
            <div className="row t-meta" style={{ gap: '4px', color: 'var(--text-secondary)' }}>
              <Hourglass size={12} aria-hidden="true" />
              <span>Starts {fmtDay(item.start_date)}</span>
            </div>
          )}
          {entries.length > 0 && (
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              {steps.done}/{steps.total} steps
            </span>
          )}
          {weekTarget !== null && weekDone !== undefined && (
            <span className="t-meta" style={{ color: weekDone >= weekTarget ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>
              {Math.min(weekDone, weekTarget)}/{weekTarget} this week
            </span>
          )}
          {item.due_date && item.type !== 'habit' && (
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
              <span>
                {scheduleLabel(item.schedule)}
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

        {onToggleFocus && !isDone && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFocus(item)}
            disabled={busy}
            aria-pressed={Boolean(focused)}
            title={focused ? 'Remove from today’s focus' : 'Add to today’s focus'}
            aria-label={focused ? `Remove ${item.name} from today’s focus` : `Add ${item.name} to today’s focus`}
          >
            <Star size={14} fill={focused ? 'currentColor' : 'none'} />
          </Button>
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

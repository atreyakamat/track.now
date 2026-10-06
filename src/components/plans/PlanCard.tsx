import { Link } from 'react-router-dom'
import { Archive, ArrowRight, Calendar, RotateCcw } from 'lucide-react'
import type { PlanSummary } from '@/domain/progress'
import { Badge, Button, ProgressBar } from '@/components/ui'
import { formatDateRange, pluralize } from '@/utils/format'

interface PlanCardProps {
  summary: PlanSummary
  trackColor?: string
  onToggleArchive?: (planId: string, currentStatus: string) => void
  busy?: boolean
}

export function PlanCard({ summary, trackColor, onToggleArchive, busy }: PlanCardProps) {
  const { plan, progress } = summary
  const isArchived = plan.status === 'archived'
  const dateRange = formatDateRange(plan.start_date, plan.end_date)

  return (
    <div className={`plan-card ${isArchived ? 'card--muted' : ''}`}>
      <div className="plan-card__main">
        <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <Link
            to={`/tracks/${plan.track_id}/plans/${plan.id}`}
            className="t-h3"
            style={{ textDecoration: 'none' }}
          >
            {plan.name}
          </Link>
          {isArchived ? (
            <Badge>Archived</Badge>
          ) : (
            <Badge accent>{pluralize(progress.total, 'Item')}</Badge>
          )}
        </div>

        {plan.description && (
          <p className="card__desc" style={{ fontSize: 'var(--text-caption)' }}>
            {plan.description}
          </p>
        )}

        {dateRange && (
          <div className="row" style={{ gap: '4px', color: 'var(--text-secondary)', fontSize: 'var(--text-meta)' }}>
            <Calendar size={12} />
            <span>{dateRange}</span>
          </div>
        )}
      </div>

      <div className="plan-card__progress">
        <ProgressBar
          percent={progress.percent}
          color={trackColor}
          label={`${plan.name} progress`}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
          <span className="t-caption" style={{ fontSize: '0.75rem' }}>
            {progress.total > 0
              ? `${progress.done}/${progress.total} done`
              : '0 items'}
          </span>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Link
          to={`/tracks/${plan.track_id}/plans/${plan.id}`}
          className="btn btn--secondary btn--sm"
          style={{ textDecoration: 'none' }}
        >
          Open <ArrowRight size={14} />
        </Link>
        {onToggleArchive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleArchive(plan.id, plan.status)}
            disabled={busy}
            title={isArchived ? 'Restore Plan' : 'Archive Plan'}
          >
            {isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
          </Button>
        )}
      </div>
    </div>
  )
}

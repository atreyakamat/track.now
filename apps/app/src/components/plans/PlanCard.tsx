import { Link } from 'react-router-dom'
import { Archive, ArrowRight, Calendar, RotateCcw } from 'lucide-react'
import type { PlanSummary } from '@tracknow/core/domain/progress'
import { Badge, Button, ProgressBar } from '@/components/ui'
import { formatDateRange, pluralize } from '@tracknow/core/utils/format'
import { PLAN_KIND_LABEL, PLAN_STATUS_LABEL, isDueForReview, planKindOf, planTimeline } from '@tracknow/core/domain/plans'

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
  const kind = planKindOf(plan)
  const timeline = planTimeline(plan)
  const review = isDueForReview(plan)

  return (
    <div className={`plan-card ${plan.status !== 'active' ? 'card--muted' : ''}`}>
      <div className="plan-card__main">
        <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <Link
            to={`/tracks/${plan.track_id}/plans/${plan.id}`}
            className="t-h3"
            style={{ textDecoration: 'none' }}
          >
            {plan.name}
          </Link>
          <Badge>{PLAN_KIND_LABEL[kind]}</Badge>
          {plan.status !== 'active' ? (
            <Badge>{PLAN_STATUS_LABEL[plan.status]}</Badge>
          ) : review ? (
            <Badge accent>Due for review</Badge>
          ) : null}
        </div>

        {plan.description && (
          <p className="card__desc" style={{ fontSize: 'var(--text-caption)' }}>
            {plan.description}
          </p>
        )}

        {dateRange && (
          <div className="row" style={{ gap: '4px', color: 'var(--text-secondary)', fontSize: 'var(--text-meta)' }}>
            <Calendar size={12} />
            <span>
              {dateRange}
              {timeline && plan.status === 'active' && timeline.phase === 'running' && ` · Day ${timeline.day} of ${timeline.totalDays}`}
              {timeline && plan.status === 'active' && timeline.phase === 'not_started' && ` · starts in ${timeline.startsInDays}d`}
            </span>
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
            {progress.total > 0 ? `${progress.done}/${progress.total} done today` : pluralize(summary.itemCountsByType ? Object.values(summary.itemCountsByType).reduce((a, b) => a + b, 0) : 0, 'item')}
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
            aria-label={isArchived ? `Restore plan ${plan.name}` : `Archive plan ${plan.name}`}
          >
            {isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
          </Button>
        )}
      </div>
    </div>
  )
}

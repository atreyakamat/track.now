import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import type { ArcSummary } from '@tracknow/core/domain/arcs'
import { Badge, ProgressBar } from '@/components/ui'
import { pluralize } from '@tracknow/core/utils/format'

export const arcPath = (arc: Pick<ArcSummary, 'key'>) => `/arcs/${encodeURIComponent(arc.key)}`

/** Compact card for an Arc (Plans grouped across Tracks). */
export function ArcCard({ arc }: { arc: ArcSummary }) {
  const t = arc.timeline
  return (
    <div className="card arc-card">
      <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Layers size={16} aria-hidden="true" />
        <Link to={arcPath(arc)} className="t-h3" style={{ textDecoration: 'none' }}>
          {arc.name}
        </Link>
        {arc.status === 'completed' && <Badge>Completed</Badge>}
      </div>
      <span className="t-meta">
        {pluralize(arc.plans.length, 'Plan')} · {pluralize(arc.trackIds.length, 'Track')}
        {t ? ` · ${t.phase === 'not_started' ? `starts in ${pluralize(t.startsInDays, 'day')}` : t.phase === 'ended' ? 'ended' : `Day ${t.day} of ${t.totalDays}`}` : ''}
      </span>
      <ProgressBar percent={arc.progress.percent} label={`${arc.name} progress`} />
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Archive, ArrowRight, RotateCcw } from 'lucide-react'
import type { TrackSummary } from '@/domain/progress'
import { Badge, Button, ProgressBar } from '@/components/ui'
import { TrackIcon } from './TrackIcon'
import { pluralize } from '@/utils/format'

interface TrackCardProps {
  summary: TrackSummary
  onToggleArchive?: (trackId: string, currentStatus: string) => void
  busy?: boolean
}

export function TrackCard({ summary, onToggleArchive, busy }: TrackCardProps) {
  const { track, activePlans, progress } = summary
  const isArchived = track.status === 'archived'

  return (
    <div className={`card ${isArchived ? 'card--muted' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card__head">
        <div
          className="icon-chip"
          style={{ background: track.color, color: '#141414' }}
          aria-hidden="true"
        >
          <TrackIcon name={track.icon} size={20} />
        </div>
        <div className="card__body">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to={`/tracks/${track.id}`} className="t-h3" style={{ textDecoration: 'none' }}>
              {track.name}
            </Link>
            {isArchived ? (
              <Badge>Archived</Badge>
            ) : (
              <Badge accent>{pluralize(activePlans.length, 'Plan')}</Badge>
            )}
          </div>
          {track.description && (
            <p className="card__desc" title={track.description}>
              {track.description}
            </p>
          )}
        </div>
      </div>

      <div>
        <ProgressBar
          percent={progress.percent}
          color={track.color}
          label={`${track.name} progress`}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
          <span className="t-caption">
            {progress.total > 0
              ? `${progress.done} of ${progress.total} items done`
              : 'No items yet'}
          </span>
          <span className="t-meta">{isArchived ? 'Inactive' : 'Active'}</span>
        </div>
      </div>

      <div className="card__foot" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
        <Link
          to={`/tracks/${track.id}`}
          className="btn btn--secondary btn--sm"
          style={{ textDecoration: 'none' }}
        >
          Open Track <ArrowRight size={14} />
        </Link>
        {onToggleArchive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleArchive(track.id, track.status)}
            disabled={busy}
            title={isArchived ? 'Restore Track' : 'Archive Track'}
          >
            {isArchived ? (
              <>
                <RotateCcw size={14} /> Restore
              </>
            ) : (
              <>
                <Archive size={14} /> Archive
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

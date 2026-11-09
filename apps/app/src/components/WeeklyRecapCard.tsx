import { CalendarCheck, X } from 'lucide-react'
import { recapHeadline, type WeeklyRecap } from '@tracknow/core/domain/recap'
import { Button } from '@/components/ui'

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })

/** A short look back at the last finished week. Shown once per week; hiding it is remembered. */
export function WeeklyRecapCard({ recap, onDismiss }: { recap: WeeklyRecap; onDismiss: () => void }) {
  return (
    <section className="card recap" aria-labelledby="recap-heading">
      <div className="section__head" style={{ marginBottom: 'var(--space-1)' }}>
        <h2 id="recap-heading" className="t-h3 row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <CalendarCheck size={16} aria-hidden="true" /> Your last week
        </h2>
        <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Hide last week's recap">
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="t-body" style={{ margin: 0 }}>
        {recapHeadline(recap)}
        {recap.bestDay && recap.bestDay.count > 1 ? ` Your best day was ${fmtDay(recap.bestDay.date)} with ${recap.bestDay.count}.` : ''}
      </p>
    </section>
  )
}

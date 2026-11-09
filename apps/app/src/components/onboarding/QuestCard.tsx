import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Compass, X } from 'lucide-react'
import type { Quest } from '@tracknow/core/domain/quests'
import { questXp } from '@tracknow/core/domain/quests'
import { track } from '@tracknow/core/services/telemetry'
import { Button, ProgressBar } from '@/components/ui'

/**
 * Getting-started quests for a new account. Every quest is checked against real records,
 * so it ticks itself off; nothing here is a reminder you have to clear.
 */
export function QuestCard({ quests, onTour, onDismiss }: { quests: Quest[]; onTour: () => void; onDismiss: () => void }) {
  const done = quests.filter((q) => q.done).length
  const all = done === quests.length
  const earned = questXp(quests)
  const total = quests.reduce((s, q) => s + q.xp, 0)
  return (
    <section className="card quests" aria-labelledby="quests-heading">
      <div className="section__head" style={{ marginBottom: 'var(--space-2)' }}>
        <h2 id="quests-heading" className="t-h3 row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <Compass size={16} aria-hidden="true" /> {all ? 'All quests complete' : 'Getting started'}
        </h2>
        <span className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="t-meta">
            {done}/{quests.length} · {earned} of {total} bonus XP
          </span>
          {!all && (
            <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Hide the quests (Settings brings them back)">
              <X size={14} aria-hidden="true" />
            </Button>
          )}
        </span>
      </div>
      <ProgressBar percent={Math.round((done / quests.length) * 100)} label="Quests completed" hideValue />
      {all ? (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span className="t-meta">You know your way around. From here, every point comes from real work.</span>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X size={14} aria-hidden="true" /> Hide
          </Button>
        </div>
      ) : (
        <ul className="quests__list">
          {quests.map((q) => (
            <li key={q.id} className={`quests__item${q.done ? ' quests__item--done' : ''}`}>
              <span className="quests__icon" aria-hidden="true">
                {q.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </span>
              <span className="quests__text">
                {q.id === 'tour' && !q.done ? (
                  <button
                    type="button"
                    className="quests__link"
                    onClick={() => {
                      track('quest_clicked', { quest: q.id })
                      onTour()
                    }}
                  >
                    {q.title}
                  </button>
                ) : q.done ? (
                  <span>{q.title}</span>
                ) : (
                  <Link to={q.to} className="quests__link" onClick={() => track('quest_clicked', { quest: q.id })}>
                    {q.title}
                  </Link>
                )}
                <span className="sr-only">{q.done ? ' (done)' : ''}</span>
                <span className="t-caption"> · {q.description}</span>
              </span>
              <span className="t-meta quests__xp">{q.done ? `+${q.xp}` : `${q.xp} XP`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Award, Lock } from 'lucide-react'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'
import {
  DAILY_ONE_OFF_CAP,
  PLAN_COMPLETION_XP,
  XP_PER_TYPE,
  calcAchievements,
  calcMomentum,
  computeXp,
  levelFor,
} from '@tracknow/core/domain/momentum'
import { calcHabitStreak } from '@tracknow/core/domain/streaks'
import { habitTrackedSince } from '@tracknow/core/domain/schedule'
import { ProgressBar } from '@/components/ui'

/** Earliest date the lifetime ledger reads from (completions are one row per item per day). */
const LIFETIME_START = '2000-01-01'

/**
 * Level, XP, Momentum and achievements — all derived from the user's real completion records.
 * Loads the lifetime ledger (item id + date only) on its own, after the rest of the page.
 */
export function ProgressPanel({ userId, items, plans }: { userId: string; items: ExecutionItem[]; plans: Plan[] }) {
  const [ledger, setLedger] = useState<CompletionRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    listCompletionHistory(userId, LIFETIME_START)
      .then((rows) => alive && setLedger(rows))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load your history.'))
    return () => {
      alive = false
    }
  }, [userId])

  const derived = useMemo(() => {
    if (!ledger) return null
    const planOf = new Map(items.map((i) => [i.id, i.plan_id]))
    const perPlan: Record<string, number> = {}
    ledger.forEach((c) => {
      const p = planOf.get(c.item_id)
      if (p) perPlan[p] = (perPlan[p] ?? 0) + 1
    })
    const completedPlans = plans.filter((p) => p.status === 'completed')
    const xp = computeXp(ledger, items, completedPlans, perPlan)
    const level = levelFor(xp.total)
    const momentum = calcMomentum(items, ledger)
    const datesByItem = new Map<string, string[]>()
    ledger.forEach((c) => datesByItem.set(c.item_id, [...(datesByItem.get(c.item_id) ?? []), c.completed_date]))
    const longestDailyStreak = items
      .filter((i) => i.type === 'habit' && !i.schedule?.times_per_week)
      .reduce((best, h) => {
        const s = calcHabitStreak(h.id, h.schedule, datesByItem.get(h.id) ?? [], undefined, 365, habitTrackedSince(h))
        return Math.max(best, s.longestStreak)
      }, 0)
    const achievements = calcAchievements({ completions: ledger, items, plans, longestDailyStreak })
    return { xp, level, momentum, achievements }
  }, [ledger, items, plans])

  return (
    <section className="section" aria-labelledby="progress-heading">
      <div className="section__head">
        <h2 id="progress-heading" className="t-h2">
          Your progress
        </h2>
      </div>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {!error && !derived && <p className="t-meta">Loading your progress…</p>}
      {derived && (
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="progress-panel">
            <div className="card progress-panel__card">
              <span className="t-meta">Level {derived.level.level}</span>
              <span className="progress-panel__value">{derived.level.name}</span>
              <ProgressBar percent={derived.level.progress} label="Progress to the next level" />
              <span className="t-meta">
                {derived.level.xp} XP · {derived.level.nextLevelXp - derived.level.xp} XP to level {derived.level.level + 1}
              </span>
            </div>
            <div className="card progress-panel__card" title={derived.momentum.explanation}>
              <span className="t-meta">Momentum (14 days)</span>
              <span className="progress-panel__value">
                {derived.momentum.score} <span className="t-meta">{derived.momentum.label}</span>
              </span>
              <ProgressBar percent={derived.momentum.score} label="Momentum" hideValue />
              <span className="t-meta">{derived.momentum.explanation}</span>
            </div>
          </div>

          <div>
            <h3 className="t-h3" style={{ marginBottom: 'var(--space-2)' }}>
              Achievements ({derived.achievements.filter((a) => a.earned).length}/{derived.achievements.length})
            </h3>
            <ul className="achievements">
              {derived.achievements.map((a) => (
                <li key={a.id} className={`achievement${a.earned ? '' : ' achievement--locked'}`}>
                  <span className="achievement__icon" aria-hidden="true">
                    {a.earned ? <Award size={16} /> : <Lock size={16} />}
                  </span>
                  <span>
                    <span className="achievement__title">{a.title}</span>
                    <span className="sr-only">{a.earned ? ' (earned)' : ' (not yet earned)'}</span>
                    <br />
                    <span className="t-meta">
                      {a.description}
                      {a.earnedOn ? ` · ${new Date(`${a.earnedOn}T00:00:00`).toLocaleDateString()}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <details className="plan-details">
            <summary>How points work</summary>
            <ul className="xp-rules">
              <li>
                Habit session {XP_PER_TYPE.habit} XP · task or checklist {XP_PER_TYPE.task} XP · project {XP_PER_TYPE.project} XP ·
                milestone {XP_PER_TYPE.milestone} XP · completed Plan {PLAN_COMPLETION_XP} XP.
              </li>
              <li>Points come only from completions. Un-completing something removes its points.</li>
              <li>
                At most {DAILY_ONE_OFF_CAP} tasks a day earn points, and weekly-target habits earn up to their target, so
                splitting work into tiny pieces earns nothing extra.
              </li>
              <li>Creating, editing or opening things never earns points. Missing a day never takes points away.</li>
              {derived.xp.capped > 0 && <li>{derived.xp.capped} completions were above a cap and earned no points.</li>}
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}

import { Link } from 'react-router-dom'
import { Flame, Trophy } from 'lucide-react'
import type { LevelInfo } from '@tracknow/core/domain/momentum'
import { pluralize } from '@tracknow/core/utils/format'

/**
 * Compact level / XP / active-day streak / this-week line for Today. Quiet by design: one
 * row, no animation, links to Analytics for the detail.
 */
export function LevelStrip({
  level,
  streak,
  week,
}: {
  level: LevelInfo
  streak: number
  week: { done: number; planned: number } | null
}) {
  const toNext = level.nextLevelXp - level.xp
  return (
    <Link to="/analytics" className="level-strip" aria-label={`Level ${level.level}, ${level.name}. ${level.xp} XP, ${toNext} XP to the next level.`}>
      <span className="level-strip__level">
        <Trophy size={14} aria-hidden="true" /> Lv {level.level} · {level.name}
      </span>
      <span className="level-strip__bar" aria-hidden="true">
        <span style={{ width: `${level.progress}%` }} />
      </span>
      <span className="t-meta level-strip__xp">
        {level.xp} XP · {toNext} to Lv {level.level + 1}
      </span>
      {streak >= 2 && (
        <span className="level-strip__streak" title="Active days in a row">
          <Flame size={14} aria-hidden="true" /> {pluralize(streak, 'day')}
        </span>
      )}
      {week && week.planned > 0 && (
        <span className="t-meta" title="Scheduled habit days and due tasks this week">
          This week {week.done}/{week.planned}
        </span>
      )}
    </Link>
  )
}

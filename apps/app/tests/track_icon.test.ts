import { describe, expect, it } from 'vitest'
import { BookOpen, Briefcase, Building2, Target, Wallet } from 'lucide-react'
import { resolveTrackIcon } from '@/components/tracks/TrackIcon'

describe('resolveTrackIcon', () => {
  it('renders kebab-case icon names seeded by the database templates', () => {
    expect(resolveTrackIcon('book-open')).toBe(BookOpen)
    expect(resolveTrackIcon('building-2')).toBe(Building2)
    expect(resolveTrackIcon('wallet')).toBe(Wallet)
    expect(resolveTrackIcon('briefcase')).toBe(Briefcase)
  })

  it('keeps PascalCase names and falls back to Target for unknown names', () => {
    expect(resolveTrackIcon('BookOpen')).toBe(BookOpen)
    expect(resolveTrackIcon('not-an-icon')).toBe(Target)
    expect(resolveTrackIcon('')).toBe(Target)
  })
})

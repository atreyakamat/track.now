import { SlidersHorizontal } from 'lucide-react'
import { usePreferences } from '@/hooks/usePreferences'
import { Select } from '@/components/ui'

/** Vocabulary, gamification and clock preferences (device-local). */
export function PreferencesCard() {
  const { prefs, update } = usePreferences()
  return (
    <section className="card" aria-labelledby="settings-prefs-heading">
      <h2 id="settings-prefs-heading" className="t-h2 row" style={{ alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <SlidersHorizontal size={18} aria-hidden="true" /> Preferences
      </h2>
      <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
        <Select label="Names" value={prefs.naming} onChange={(e) => update({ naming: e.target.value as 'standard' | 'simple' })} hint={prefs.naming === 'simple' ? 'Areas, Goals and Challenges.' : 'Tracks, Plans and Arcs (the precise model).'}>
          <option value="standard">Standard: Tracks · Plans · Arcs</option>
          <option value="simple">Simple: Areas · Goals · Challenges</option>
        </Select>
        <Select label="Motivation" value={prefs.gamification} onChange={(e) => update({ gamification: e.target.value as 'full' | 'gentle' })} hint={prefs.gamification === 'gentle' ? 'XP, levels, quests and achievements are hidden. Momentum stays.' : 'XP, levels, quests and achievements are shown.'}>
          <option value="full">Full: XP, levels, quests</option>
          <option value="gentle">Gentle: Momentum only</option>
        </Select>
        <Select label="Clock" value={prefs.timeFormat} onChange={(e) => update({ timeFormat: e.target.value as 'auto' | '12h' | '24h' })} hint="How reminder times are written.">
          <option value="auto">Follow this device</option>
          <option value="12h">12-hour (6:30 pm)</option>
          <option value="24h">24-hour (18:30)</option>
        </Select>
      </div>
      <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
        Saved on this device. Weeks always run Monday to Sunday.
      </p>
    </section>
  )
}

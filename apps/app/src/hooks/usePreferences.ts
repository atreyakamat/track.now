import { useEffect, useState } from 'react'
import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChange, savePreferences, type AppPreferences } from '@tracknow/core/services/preferences'
import { termsFor, type Terms } from '@tracknow/core/domain/terms'
import { useAuth } from '@/features/auth/AuthProvider'

/** The signed-in user's device preferences (vocabulary, gamification, clock) and the matching terms. */
export function usePreferences(): { prefs: AppPreferences; terms: Terms; gentle: boolean; update: (patch: Partial<AppPreferences>) => void } {
  const { user } = useAuth()
  const userId = user?.id
  const [prefs, setPrefs] = useState<AppPreferences>(() => (userId ? loadPreferences(userId) : DEFAULT_PREFERENCES))

  useEffect(() => {
    setPrefs(userId ? loadPreferences(userId) : DEFAULT_PREFERENCES)
    return onPreferencesChange((p) => setPrefs(p))
  }, [userId])

  return {
    prefs,
    terms: termsFor(prefs.naming),
    gentle: prefs.gamification === 'gentle',
    update: (patch) => {
      if (userId) setPrefs(savePreferences(userId, patch))
    },
  }
}

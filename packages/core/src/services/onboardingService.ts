import { getStorage } from '../platform/storage'

/**
 * First-run onboarding flag. Device-local (same storage model as reminders/prefs): once the
 * user has seen the welcome, we never show it again on this device.
 */
const ONBOARDED_KEY = 'tracknow_onboarded'

export function hasCompletedOnboarding(): boolean {
  try {
    return getStorage()?.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingComplete(): void {
  try {
    getStorage()?.setItem(ONBOARDED_KEY, '1')
  } catch {
    /* storage unavailable — worst case the welcome shows again next launch */
  }
}

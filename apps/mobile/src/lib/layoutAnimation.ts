import { AccessibilityInfo, LayoutAnimation, Platform, UIManager } from 'react-native'

/**
 * Gentle, opt-in layout animation for list reflows (an item moving between Today sections, or a
 * deletion closing the gap). Call `animateNextLayout()` immediately before the state update that
 * changes the list; React Native animates that one commit.
 *
 * Safe by construction:
 *  - It animates nothing when the user has asked the OS to reduce motion.
 *  - It only ever runs for the single next commit, so unrelated screens are unaffected.
 *  - If the platform cannot animate (very old setups), the state update still happens instantly.
 */

let reduceMotion = false
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotion = v
  })
  .catch(() => undefined)
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduceMotion = v
})

// On Android's old architecture LayoutAnimation is off unless enabled. Harmless on the new
// architecture (where it is already on) and on iOS.
if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true)
  } catch {
    /* ignore: the state update will simply not animate */
  }
}

const GENTLE = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)

/** Animate the next layout commit, unless the user prefers reduced motion. */
export function animateNextLayout(): void {
  if (reduceMotion) return
  try {
    LayoutAnimation.configureNext(GENTLE)
  } catch {
    /* ignore: proceed without animation */
  }
}

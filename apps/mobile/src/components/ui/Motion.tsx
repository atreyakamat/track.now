import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from 'react-native'

/** True when the user asked the OS to reduce motion; animations then render their end state. */
function useReducedMotion(): React.MutableRefObject<boolean> {
  const reduced = useRef(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) reduced.current = v
      })
      .catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduced.current = v
    })
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduced
}

/** Fades and lifts its children in on mount. `index` staggers a list (capped so long lists stay quick). */
export function FadeIn({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: ViewStyle }) {
  const progress = useRef(new Animated.Value(0)).current
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced.current) {
      progress.setValue(1)
      return
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, index, reduced])
  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  )
}

/** A quick spring "pop" whenever `active` turns true (a completed check, an earned star). */
export function Pop({ active, children, style }: { active: boolean; children: React.ReactNode; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current
  const was = useRef(active)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (active && !was.current && !reduced.current) {
      scale.setValue(0.7)
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start()
    }
    was.current = active
  }, [active, scale, reduced])
  return <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
}

/** A bar whose fill eases to its new width. */
export function AnimatedBar({ percent, color, trackColor, height = 6 }: { percent: number; color: string; trackColor: string; height?: number }) {
  const value = useRef(new Animated.Value(Math.max(0, Math.min(100, percent)))).current
  const reduced = useReducedMotion()
  useEffect(() => {
    const to = Math.max(0, Math.min(100, percent))
    if (reduced.current) {
      value.setValue(to)
      return
    }
    Animated.timing(value, { toValue: to, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [percent, value, reduced])
  return (
    <Animated.View style={{ height, borderRadius: 999, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: color, width: value.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
    </Animated.View>
  )
}

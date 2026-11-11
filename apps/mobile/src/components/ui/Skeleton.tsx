import { useEffect, useRef } from 'react'
import { Animated, View, type ViewStyle } from 'react-native'
import { useReducedMotion } from './Motion'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/**
 * A single placeholder block that gently pulses while real content loads. With "reduce motion"
 * on, it holds a steady tint instead of pulsing. Purely decorative, so it is hidden from
 * assistive tech (the surrounding screen announces its own loading state).
 */
export function Skeleton({ width, height = 14, style }: { width?: number | `${number}%`; height?: number; style?: ViewStyle }) {
  const { colors } = useTheme()
  const pulse = useRef(new Animated.Value(0.5)).current
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced.current) {
      pulse.setValue(0.7)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduced])
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: width ?? '100%', height, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity: pulse }, style]}
    />
  )
}

/** One card-shaped placeholder: a tick circle, a title line and a shorter meta line. */
export function CardSkeleton() {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: 'center' }}>
      <Skeleton width={28} height={28} style={{ borderRadius: 999 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={10} />
      </View>
    </View>
  )
}

/** A few card placeholders, used while a list loads for the first time. */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: spacing[3] }}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  )
}

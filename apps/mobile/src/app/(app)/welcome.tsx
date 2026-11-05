import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { markOnboardingComplete } from '@tracknow/core/services/onboardingService'
import { Button, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

function Point({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={colors.accentPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" weight="semibold">
          {title}
        </Text>
        <Text variant="meta" tone="secondary">
          {body}
        </Text>
      </View>
    </View>
  )
}

export default function WelcomeScreen() {
  const { colors } = useTheme()
  const { displayName } = useAuth()
  const router = useRouter()

  const done = (next: '/guide' | '/(app)/(tabs)') => {
    markOnboardingComplete()
    router.replace(next)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[7], paddingBottom: spacing[5], justifyContent: 'space-between' }}>
        <View style={{ gap: spacing[5] }}>
          <View style={{ gap: spacing[2] }}>
            <Text variant="display" style={{ fontSize: 34 }}>
              Welcome{displayName && displayName !== 'You' ? `, ${displayName}` : ''}.
            </Text>
            <Text variant="caption" tone="secondary">
              Track.now turns what you want to achieve into daily habits and tasks — and keeps you on them.
            </Text>
          </View>

          <View style={{ gap: spacing[4] }}>
            <Point icon="compass" title="Plan a goal" body="Pick a goal and we set up a track with habits, tasks and a milestone." />
            <Point icon="check-circle" title="Do it today" body="Your Today list shows exactly what's due, with streaks and reminders." />
            <Point icon="bar-chart-2" title="See progress" body="Consistency heatmap and insights built only from what you actually complete." />
          </View>
        </View>

        <View style={{ gap: spacing[3] }}>
          <Button
            title="Plan my first goal"
            block
            icon={<Feather name="arrow-right" size={16} color={colors.controlText} />}
            onPress={() => done('/guide')}
          />
          <Button title="Explore on my own" variant="ghost" block onPress={() => done('/(app)/(tabs)')} />
        </View>
      </View>
    </SafeAreaView>
  )
}

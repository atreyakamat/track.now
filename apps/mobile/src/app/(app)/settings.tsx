import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card, Screen, Text } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

function SegmentedTheme() {
  const { preference, setPreference, colors } = useTheme()
  const options: { key: ThemePreference; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'System' },
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        padding: spacing.half + 2,
        gap: spacing.half + 2,
      }}
    >
      {options.map((opt) => {
        const active = preference === opt.key
        return (
          <View key={opt.key} style={{ flex: 1 }}>
            <Button
              title={opt.label}
              size="sm"
              block
              variant={active ? 'primary' : 'ghost'}
              onPress={() => setPreference(opt.key)}
            />
          </View>
        )
      })}
    </View>
  )
}

export default function SettingsScreen() {
  const { user, displayName, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      // The root AuthGate redirects to the login screen once the session is cleared.
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <Screen>
      <PageHeader title="Settings" />

      <View style={{ gap: spacing[4] }}>
        <Card style={{ gap: spacing[1] }}>
          <Text variant="meta" tone="tertiary">
            Account
          </Text>
          <Text variant="h3">{displayName}</Text>
          {user?.email ? (
            <Text variant="caption" tone="secondary">
              {user.email}
            </Text>
          ) : null}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text variant="meta" tone="tertiary">
            Appearance
          </Text>
          <SegmentedTheme />
        </Card>

        <Button
          title={signingOut ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          block
          loading={signingOut}
          onPress={handleSignOut}
        />
      </View>
    </Screen>
  )
}

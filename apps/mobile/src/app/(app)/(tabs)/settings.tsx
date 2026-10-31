import { useState } from 'react'
import { View } from 'react-native'
import { updateProfile } from '@tracknow/core/services/tracksService'
import { Button, Card, Screen, Text, TextField } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
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
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => (
        <View key={opt.key} style={{ flex: 1 }}>
          <Button
            title={opt.label}
            size="sm"
            block
            variant={preference === opt.key ? 'primary' : 'ghost'}
            onPress={() => setPreference(opt.key)}
          />
        </View>
      ))}
    </View>
  )
}

export default function SettingsScreen() {
  const { user, profile, displayName, signOut, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(profile?.display_name ?? profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const saveName = async () => {
    if (!user || savingName) return
    const trimmed = name.trim()
    if (!trimmed) return
    setSavingName(true)
    try {
      await updateProfile(user.id, { full_name: trimmed, display_name: trimmed })
      await refreshProfile()
      showToast({ title: 'Profile updated', type: 'success' })
    } catch (err) {
      showToast({
        title: 'Could not save',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
    } finally {
      setSavingName(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <Screen>
      <PageHeader title="Settings" />

      <View style={{ gap: spacing[4] }}>
        <Card style={{ gap: spacing[3] }}>
          <Text variant="meta" tone="tertiary">
            Profile
          </Text>
          <TextField label="Display name" value={name} onChangeText={setName} placeholder={displayName} />
          {user?.email ? (
            <Text variant="caption" tone="secondary">
              {user.email}
            </Text>
          ) : null}
          <Button
            title={savingName ? 'Saving…' : 'Save profile'}
            variant="secondary"
            size="sm"
            loading={savingName}
            onPress={saveName}
          />
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text variant="meta" tone="tertiary">
            Appearance
          </Text>
          <SegmentedTheme />
        </Card>

        <Card style={{ gap: spacing[2] }}>
          <Text variant="meta" tone="tertiary">
            Notifications
          </Text>
          <Text variant="caption" tone="secondary">
            Reminders you set appear inside Track.now while it is open. Alerts that fire when the app is closed, and
            home-screen widgets, arrive in a later update.
          </Text>
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

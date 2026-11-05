import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { updateProfile } from '@tracknow/core/services/tracksService'
import { Button, Card, ConfirmDialog, Screen, Text, TextField } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { getNotificationPermission, requestPermission } from '@/lib/notifications'
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
  const { colors } = useTheme()
  const [name, setName] = useState(profile?.display_name ?? profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null)
  const [enablingNotif, setEnablingNotif] = useState(false)

  // Sync the field once the profile resolves (it can load after first render).
  useEffect(() => {
    if (profile) setName(profile.display_name ?? profile.full_name ?? '')
    // Keyed on identity so an in-progress edit is never clobbered mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    let active = true
    void getNotificationPermission().then((granted) => {
      if (active) setNotifEnabled(granted)
    })
    return () => {
      active = false
    }
  }, [])

  const saveName = async () => {
    if (!user || savingName) return
    const trimmed = name.trim()
    if (!trimmed) {
      showToast({ title: 'Enter a display name', type: 'warning' })
      return
    }
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

  const enableNotifications = async () => {
    setEnablingNotif(true)
    try {
      const granted = await requestPermission()
      setNotifEnabled(granted)
      showToast(
        granted
          ? { title: 'Notifications enabled', type: 'success' }
          : {
              title: 'Permission not granted',
              message: 'Enable notifications for Track.now in your system settings to get reminders.',
              type: 'warning',
            },
      )
    } finally {
      setEnablingNotif(false)
    }
  }

  const handleSignOut = async () => {
    setConfirmSignOut(false)
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

        <Card style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="meta" tone="tertiary">
              Notifications
            </Text>
            {notifEnabled !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                <Feather
                  name={notifEnabled ? 'check-circle' : 'bell-off'}
                  size={14}
                  color={notifEnabled ? colors.success : colors.textTertiary}
                />
                <Text variant="meta" style={{ color: notifEnabled ? colors.success : colors.textTertiary }}>
                  {notifEnabled ? 'Enabled' : 'Off'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="secondary">
            Reminders you set fire as device alerts even when Track.now is closed, and feed the home-screen widget.
          </Text>
          {notifEnabled === false ? (
            <Button
              title={enablingNotif ? 'Requesting…' : 'Enable notifications'}
              variant="secondary"
              size="sm"
              loading={enablingNotif}
              onPress={enableNotifications}
            />
          ) : null}
        </Card>

        <Button
          title={signingOut ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          block
          loading={signingOut}
          onPress={() => setConfirmSignOut(true)}
        />
      </View>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You'll need to sign in again to see your tracks."
        confirmLabel="Sign out"
        cancelLabel="Stay"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </Screen>
  )
}

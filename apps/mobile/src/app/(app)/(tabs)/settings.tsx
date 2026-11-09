import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Switch, View } from 'react-native'
import { updateProfile } from '@tracknow/core/services/tracksService'
import { loadNotificationPreferences, saveNotificationPreferences } from '@tracknow/core/services/notificationPreferences'
import { onboardingState } from '@tracknow/core/services/onboardingState'
import { loadPreferences, savePreferences, type AppPreferences } from '@tracknow/core/services/preferences'
import type { NotificationPreferences } from '@tracknow/core/types/notifications'
import { Button, Card, ConfirmDialog, Screen, Text, TextField } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { PasswordCard } from '@/components/settings/PasswordCard'
import { PlanImportCard } from '@/components/settings/PlanImportCard'
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
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {options.map((opt) => (
        <View key={opt.key} style={{ flex: 1 }}>
          <Button title={opt.label} size="sm" block variant={preference === opt.key ? 'primary' : 'ghost'} onPress={() => setPreference(opt.key)} />
        </View>
      ))}
    </View>
  )
}

export default function SettingsScreen() {
  const { user, profile, displayName, signOut, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()
  const [name, setName] = useState(profile?.display_name ?? profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null)
  const [enablingNotif, setEnablingNotif] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [appPrefs, setAppPrefs] = useState<AppPreferences | null>(null)

  useEffect(() => {
    if (user?.id) {
      setPrefs(loadNotificationPreferences(user.id))
      setAppPrefs(loadPreferences(user.id))
    }
  }, [user?.id])

  const setPref = (patch: Partial<NotificationPreferences>) => {
    if (!user?.id || !prefs) return
    const nextPrefs = { ...prefs, ...patch }
    setPrefs(nextPrefs)
    saveNotificationPreferences(user.id, nextPrefs)
  }

  useEffect(() => {
    if (profile) setName(profile.display_name ?? profile.full_name ?? '')
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
      showToast({ title: 'Could not save', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
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
          : { title: 'Permission not granted', message: 'Enable notifications for Track.now in your system settings to get reminders.', type: 'warning' },
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

  const goToday = () => router.replace('/(app)/(tabs)')

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
          <Button title={savingName ? 'Saving…' : 'Save profile'} variant="secondary" size="sm" loading={savingName} onPress={saveName} />
        </Card>

        {user?.email ? <PasswordCard email={user.email} /> : null}

        <Card style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="meta" tone="tertiary">
              Notifications
            </Text>
            {notifEnabled !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                <Feather name={notifEnabled ? 'check-circle' : 'bell-off'} size={14} color={notifEnabled ? colors.success : colors.textTertiary} />
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
            <Button title={enablingNotif ? 'Requesting…' : 'Enable notifications'} variant="secondary" size="sm" loading={enablingNotif} onPress={enableNotifications} />
          ) : null}
          {notifEnabled && prefs ? (
            <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="caption" style={{ flex: 1, paddingRight: spacing[3] }}>
                  Weekly review nudge
                </Text>
                <Switch value={prefs.weeklyReviewNudge} onValueChange={(v) => setPref({ weeklyReviewNudge: v })} trackColor={{ true: colors.accentPrimary, false: colors.surfaceMuted }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="caption" style={{ flex: 1, paddingRight: spacing[3] }}>
                  Evening streak reminder
                </Text>
                <Switch value={prefs.streakNudge} onValueChange={(v) => setPref({ streakNudge: v })} trackColor={{ true: colors.accentPrimary, false: colors.surfaceMuted }} />
              </View>
            </View>
          ) : null}
        </Card>

        {appPrefs ? (
          <Card style={{ gap: spacing[3] }}>
            <Text variant="meta" tone="tertiary">
              Motivation
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text variant="caption">Gentle mode</Text>
                <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Hides XP, levels, quests and achievements. Momentum stays.
                </Text>
              </View>
              <Switch
                value={appPrefs.gamification === 'gentle'}
                onValueChange={(v) => {
                  if (user?.id) setAppPrefs(savePreferences(user.id, { gamification: v ? 'gentle' : 'full' }))
                }}
                trackColor={{ true: colors.accentPrimary, false: colors.surfaceMuted }}
              />
            </View>
          </Card>
        ) : null}

        {appPrefs ? (
          <Card style={{ gap: spacing[3] }}>
            <Text variant="meta" tone="tertiary">
              Diagnostics
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text variant="caption">Share usage and error reports</Text>
                <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Helps fix bugs and improve Track.now. Sends which features you use and crash details, never your item names or notes.
                </Text>
              </View>
              <Switch
                value={appPrefs.shareDiagnostics}
                onValueChange={(v) => {
                  if (user?.id) setAppPrefs(savePreferences(user.id, { shareDiagnostics: v }))
                }}
                trackColor={{ true: colors.accentPrimary, false: colors.surfaceMuted }}
              />
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: spacing[3] }}>
          <Text variant="meta" tone="tertiary">
            Tour and quests
          </Text>
          <Text variant="caption" tone="secondary">
            Replay the two-minute tour, or bring the getting-started quests back to Today.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
            <Button
              title="Replay the tour"
              variant="secondary"
              size="sm"
              icon={<Feather name="compass" size={14} color={colors.textPrimary} />}
              onPress={() => {
                if (user?.id) onboardingState.setTourRequested(user.id)
                goToday()
              }}
            />
            <Button
              title="Show quests"
              variant="ghost"
              size="sm"
              onPress={() => {
                if (user?.id) onboardingState.setQuestsDismissed(user.id, false)
                goToday()
              }}
            />
          </View>
        </Card>

        {user?.id ? <PlanImportCard userId={user.id} /> : null}

        <Card style={{ gap: spacing[3] }}>
          <Text variant="meta" tone="tertiary">
            Appearance
          </Text>
          <SegmentedTheme />
        </Card>

        <Button title={signingOut ? 'Signing out…' : 'Sign out'} variant="secondary" block loading={signingOut} onPress={() => setConfirmSignOut(true)} />
      </View>

      <ConfirmDialog visible={confirmSignOut} title="Sign out?" message="You'll need to sign in again to see your tracks." confirmLabel="Sign out" cancelLabel="Stay" onConfirm={handleSignOut} onCancel={() => setConfirmSignOut(false)} />
    </Screen>
  )
}

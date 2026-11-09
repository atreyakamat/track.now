import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Share, View } from 'react-native'
import { createPlanShare, listPlanShares, revokePlanShare, type PlanShare } from '@tracknow/core/services/shareService'
import { Button, Card, Text } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

/** The public web app hosts the read-only page for a share link. */
const SHARE_ORIGIN = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://trackapp.atreyakamat.dev'

/** Accountability partner: a read-only link to this Plan, sent with the system share sheet. */
export function SharePlanCard({ userId, planId, planName }: { userId: string; planId: string; planName: string }) {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const [shares, setShares] = useState<PlanShare[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listPlanShares(planId)
      .then((s) => alive && setShares(s))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load sharing.'))
    return () => {
      alive = false
    }
  }, [planId])

  const linkFor = (s: PlanShare) => `${SHARE_ORIGIN}/share/${s.token}`
  const send = async (s: PlanShare) => {
    try {
      await Share.share({ message: `Follow my progress on “${planName}”: ${linkFor(s)}` })
    } catch {
      /* the user dismissed the sheet */
    }
  }
  const create = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const s = await createPlanShare(userId, planId)
      setShares((prev) => [...(prev ?? []), s])
      await send(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the link.')
    } finally {
      setBusy(false)
    }
  }
  const revoke = async (s: PlanShare) => {
    if (busy) return
    setBusy(true)
    try {
      await revokePlanShare(s.id)
      setShares((prev) => (prev ?? []).filter((x) => x.id !== s.id))
      showToast({ title: 'Link revoked', message: 'It no longer opens anything.', type: 'info' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke the link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Feather name="users" size={14} color={colors.textSecondary} />
        <Text variant="meta" tone="secondary">
          Share with a partner or coach
        </Text>
      </View>
      <Text variant="caption" tone="secondary">
        A read-only page with this plan’s items and the last 90 days of completions. Nothing else from your account is visible.
      </Text>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      {(shares ?? []).map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            …/share/{s.token.slice(0, 10)}…
          </Text>
          <Button title="Send" size="sm" variant="ghost" onPress={() => void send(s)} />
          <Button title="Revoke" size="sm" variant="ghost" onPress={() => void revoke(s)} disabled={busy} />
        </View>
      ))}
      <Button
        title={busy ? 'Working…' : 'Create a share link'}
        size="sm"
        variant="secondary"
        icon={<Feather name="link" size={14} color={colors.textPrimary} />}
        onPress={create}
        disabled={busy || shares === null}
      />
    </Card>
  )
}

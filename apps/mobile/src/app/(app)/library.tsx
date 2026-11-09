import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PLAN_LIBRARY, materializeLibraryEntry, type LibraryEntry } from '@tracknow/core/constants/planLibrary'
import { parsePlanFile } from '@tracknow/core/domain/planImport'
import { importPlanFile } from '@tracknow/core/services/planImportService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { AppBar } from '@/components/AppBar'
import { Badge, Button, Card, DateField, Text } from '@/components/ui'
import { FadeIn } from '@/components/ui/Motion'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const CATEGORY_LABEL: Record<LibraryEntry['category'], string> = {
  arc: 'Whole-life Arc',
  routine: 'Routine',
  learning: 'Learning',
  health: 'Health',
  money: 'Money',
  home: 'Home',
  creative: 'Creative',
}

/** The Plan library: ready-made setups, imported in one tap and then yours to change. */
export default function LibraryScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState<LibraryEntry | null>(null)
  const [startDate, setStartDate] = useState<string | null>(getTodayDateString())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const start = startDate ?? getTodayDateString()
  const preview = useMemo(() => (open ? parsePlanFile(materializeLibraryEntry(open, start)) : null), [open, start])

  const run = async () => {
    if (!user || !open || !preview?.file || busy) return
    setBusy(true)
    setProgress({ done: 0, total: 1 })
    const report = await importPlanFile(user.id, preview.file, (done, total) => setProgress({ done, total }))
    setBusy(false)
    setProgress(null)
    if (report.error) {
      showToast({ title: 'Import stopped', message: report.error, type: 'warning', duration: 9000 })
      return
    }
    showToast({
      title: `${open.title} is ready`,
      message: `${report.tracksCreated} new tracks, ${report.plansCreated} plans, ${report.itemsCreated} items.${report.plansSkipped.length ? ` ${report.plansSkipped.length} existing plans skipped.` : ''}`,
      type: 'success',
      duration: 9000,
    })
    setOpen(null)
    router.replace('/(app)/(tabs)')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: spacing[4] }}>
        <AppBar title="Library" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[3] }} showsVerticalScrollIndicator={false}>
        <Text variant="caption" tone="secondary">
          Ready-made setups. Pick one, choose a start date, and it becomes real tracks, plans and items you can change freely. Importing the same one twice never duplicates anything.
        </Text>
        {PLAN_LIBRARY.map((e, i) => (
          <FadeIn key={e.key} index={i}>
            <Card style={{ gap: spacing[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] }}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{e.title}</Text>
                  <Text variant="caption" tone="secondary">
                    {e.tagline}
                  </Text>
                </View>
                <Badge label={e.lengthDays ? `${e.lengthDays} days` : 'Ongoing'} />
              </View>
              <Text variant="caption" tone="secondary">
                {e.blurb}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="meta" tone="tertiary">
                  {CATEGORY_LABEL[e.category]}
                </Text>
                <Button title="Use this" size="sm" icon={<Feather name="download" size={14} color={colors.controlText} />} onPress={() => setOpen(e)} />
              </View>
            </Card>
          </FadeIn>
        ))}
      </ScrollView>

      <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={() => (busy ? undefined : setOpen(null))}>
        <Pressable onPress={() => (busy ? undefined : setOpen(null))} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(ev) => ev.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[4], paddingBottom: spacing[6], gap: spacing[3], maxHeight: '85%' }}
          >
            {open ? (
              <>
                <Text variant="h2">{open.title}</Text>
                <Text variant="caption" tone="secondary">
                  {open.blurb}
                </Text>
                <DateField label="Start date" value={startDate} onChange={setStartDate} />
                {preview?.file ? (
                  <ScrollView style={{ maxHeight: 180 }}>
                    <Text variant="meta" tone="tertiary">
                      {preview.counts.tracks} tracks · {preview.counts.plans} plans · {preview.counts.items} items
                    </Text>
                    {preview.file.tracks.map((t) => (
                      <Text key={t.name} variant="caption" tone="secondary">
                        <Text variant="caption" weight="semibold">
                          {t.name}
                        </Text>
                        : {t.plans.map((p) => `${p.name} (${p.items.length})`).join(', ')}
                      </Text>
                    ))}
                  </ScrollView>
                ) : (
                  <Text variant="caption" tone="danger">
                    {preview?.errors.join(' ')}
                  </Text>
                )}
                <Button title={busy ? `Importing… ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Import'} block loading={busy} disabled={!preview?.file} onPress={run} />
                <Button title="Cancel" variant="ghost" block disabled={busy} onPress={() => setOpen(null)} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

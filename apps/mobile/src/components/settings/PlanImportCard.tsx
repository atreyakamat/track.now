import { useState } from 'react'
import { View } from 'react-native'
import { parsePlanFile, type ParseResult } from '@tracknow/core/domain/planImport'
import { importPlanFile, type ImportReport } from '@tracknow/core/services/planImportService'
import { Button, Card, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

/**
 * Import a plan file (tracknow.plan.v1) by pasting its JSON. Shows a preview first; importing
 * the same file twice never creates duplicates (existing Tracks are reused, Plans skipped).
 */
export function PlanImportCard({ userId }: { userId: string }) {
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const preview = () => {
    setReport(null)
    setParsed(parsePlanFile(text))
  }

  const run = async () => {
    if (!parsed?.file) return
    setProgress({ done: 0, total: 1 })
    const r = await importPlanFile(userId, parsed.file, (done, total) => setProgress({ done, total }))
    setProgress(null)
    setReport(r)
    if (!r.error) {
      setText('')
      setParsed(null)
    }
  }

  return (
    <Card style={{ gap: spacing[3] }}>
      <Text variant="meta" tone="tertiary">
        Import a plan
      </Text>
      <Text variant="caption" tone="secondary">
        Paste a Track.now plan file (format tracknow.plan.v1) — or a full data export from the web app’s Settings → Your data — to set up Tracks, Plans and items in one step. Completion history and archived things are not imported. Existing Tracks with the same name are reused and existing Plans are skipped.
      </Text>
      <TextField
        label="Plan file (JSON)"
        value={text}
        onChangeText={(t) => {
          setText(t)
          setParsed(null)
          setReport(null)
        }}
        placeholder='{"format":"tracknow.plan.v1", "tracks":[…]}'
        multiline
        numberOfLines={5}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: 110, textAlignVertical: 'top', fontSize: 12 }}
      />
      {parsed && parsed.errors.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: spacing[2], gap: 2 }}>
          {parsed.errors.slice(0, 6).map((e) => (
            <Text key={e} variant="caption" tone="danger">
              {e}
            </Text>
          ))}
        </View>
      ) : null}
      {parsed?.file ? (
        <Text variant="caption">
          {parsed.file.title ? `${parsed.file.title} · ` : ''}
          {parsed.counts.tracks} Tracks, {parsed.counts.plans} Plans, {parsed.counts.items} items ready to import.
        </Text>
      ) : null}
      {progress ? (
        <Text variant="caption" tone="secondary">
          Importing… {progress.done}/{progress.total}
        </Text>
      ) : null}
      {report ? (
        <Text variant="caption" tone={report.error ? 'danger' : 'success'}>
          {report.error
            ? `Stopped: ${report.error}`
            : `Done: ${report.tracksCreated} Tracks created (${report.tracksReused} reused), ${report.plansCreated} Plans, ${report.itemsCreated} items.${report.plansSkipped.length ? ` Skipped ${report.plansSkipped.length} existing Plans.` : ''}`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button title="Preview" variant="secondary" size="sm" onPress={preview} disabled={!text.trim() || Boolean(progress)} />
        <Button title="Import" size="sm" onPress={run} disabled={!parsed?.file || Boolean(progress)} loading={Boolean(progress)} />
      </View>
    </Card>
  )
}

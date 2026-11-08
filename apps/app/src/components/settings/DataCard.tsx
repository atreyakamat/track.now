import { useRef, useState } from 'react'
import { Database, Download, Upload } from 'lucide-react'
import { listTracks } from '@tracknow/core/services/tracksService'
import { listPlans } from '@tracknow/core/services/plansService'
import { createExecutionItem, listExecutionItems } from '@tracknow/core/services/executionService'
import { listCompletionHistory } from '@tracknow/core/services/historyService'
import { buildExportBundle, completionsCsv, itemsCsv } from '@tracknow/core/domain/exportData'
import { importItemsFromCsv, type CsvImportResult } from '@tracknow/core/domain/csvImport'
import type { Plan } from '@tracknow/core/types/domain'
import { useToast } from '@/features/notifications/ToastContext'
import { usePreferences } from '@/hooks/usePreferences'
import { Button, Select } from '@/components/ui'

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Export everything (JSON or CSV) and import items from a CSV (Todoist, Habitica, a sheet). */
export function DataCard({ userId }: { userId: string }) {
  const { showToast } = useToast()
  const { terms } = usePreferences()
  const [busy, setBusy] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [planId, setPlanId] = useState('')
  const [parsed, setParsed] = useState<CsvImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportAll = async (format: 'json' | 'csv') => {
    if (busy) return
    setBusy(format)
    try {
      const [tracks, planList, items, completions] = await Promise.all([listTracks(), listPlans(), listExecutionItems(), listCompletionHistory(userId, '2000-01-01')])
      const bundle = buildExportBundle({ tracks, plans: planList, items, completions })
      const stamp = bundle.exportedAt.slice(0, 10)
      if (format === 'json') download(`tracknow-export-${stamp}.json`, JSON.stringify(bundle, null, 2), 'application/json')
      else {
        download(`tracknow-items-${stamp}.csv`, itemsCsv(bundle), 'text/csv')
        download(`tracknow-completions-${stamp}.csv`, completionsCsv(bundle), 'text/csv')
      }
      showToast({ title: 'Export ready', message: `${tracks.length} ${terms.tracks.toLowerCase()}, ${planList.length} ${terms.plans.toLowerCase()}, ${items.length} items, ${completions.length} completions.`, type: 'success' })
    } catch (err) {
      showToast({ title: 'Export failed', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    } finally {
      setBusy(null)
    }
  }

  const pickCsv = async (file: File) => {
    const text = await file.text()
    const result = importItemsFromCsv(text)
    setParsed(result)
    if (!plans) {
      const list = (await listPlans()).filter((p) => p.status === 'active')
      setPlans(list)
      setPlanId(list[0]?.id ?? '')
    }
  }

  const runImport = async () => {
    if (!parsed || !planId || busy) return
    const plan = plans?.find((p) => p.id === planId)
    if (!plan) return
    setBusy('import')
    let created = 0
    try {
      for (const it of parsed.items) {
        await createExecutionItem(userId, {
          plan_id: plan.id,
          track_id: plan.track_id,
          type: it.type,
          name: it.name,
          description: it.description,
          priority: it.priority,
          due_date: it.due_date,
          target_count: 1,
          schedule:
            it.type === 'habit'
              ? { frequency: it.times_per_week || (it.days_of_week && it.days_of_week.length < 7) ? 'weekly' : 'daily', days_of_week: it.times_per_week ? null : it.days_of_week && it.days_of_week.length < 7 ? it.days_of_week : null, time_of_day: 'anytime', times_per_week: it.times_per_week }
              : null,
        })
        created++
      }
      showToast({ title: 'Import done', message: `${created} items added to ${plan.name}.`, type: 'success' })
      setParsed(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      showToast({ title: `Import stopped after ${created} items`, message: err instanceof Error ? err.message : 'Please try again.', type: 'warning', duration: 9000 })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card" aria-labelledby="settings-data-heading">
      <h2 id="settings-data-heading" className="t-h2 row" style={{ alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <Database size={18} aria-hidden="true" /> Your data
      </h2>
      <p className="t-caption" style={{ marginBottom: 'var(--space-3)' }}>
        Everything you own, as a file you keep. JSON is complete and re-importable later; CSV opens in any spreadsheet.
      </p>
      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <Button variant="secondary" onClick={() => void exportAll('json')} disabled={Boolean(busy)} aria-busy={busy === 'json'}>
          <Download size={16} aria-hidden="true" /> Export JSON
        </Button>
        <Button variant="secondary" onClick={() => void exportAll('csv')} disabled={Boolean(busy)} aria-busy={busy === 'csv'}>
          <Download size={16} aria-hidden="true" /> Export CSV
        </Button>
      </div>

      <h3 className="t-h3" style={{ marginBottom: 'var(--space-2)' }}>
        Import items from a CSV
      </h3>
      <p className="t-caption" style={{ marginBottom: 'var(--space-2)' }}>
        Todoist or Habitica exports, or any sheet with a <code>name</code> column (optional: type, due, priority, days, description). Habits with days or “3x a week” are recognised.
      </p>
      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
          <Upload size={16} aria-hidden="true" /> Choose CSV
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void pickCsv(e.target.files[0])} />
        </label>
        {parsed && plans && (
          <>
            <div style={{ minWidth: 220 }}>
              <Select label={`Into which ${terms.plan}?`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" onClick={() => void runImport()} disabled={!parsed.items.length || !planId || Boolean(busy)} aria-busy={busy === 'import'}>
              Import {parsed.items.length} items
            </Button>
          </>
        )}
      </div>
      {parsed && (
        <p className={`t-caption${parsed.errors.length ? ' alert alert--error' : ''}`} style={{ marginTop: 'var(--space-2)' }} role={parsed.errors.length ? 'alert' : undefined}>
          {parsed.errors.length ? parsed.errors.join(' ') : `${parsed.items.length} items read (${parsed.items.filter((i) => i.type === 'habit').length} habits)${parsed.skipped ? `, ${parsed.skipped} empty rows skipped` : ''}. Columns: ${parsed.columns.join(', ') || 'single column'}.`}
        </p>
      )}
    </section>
  )
}

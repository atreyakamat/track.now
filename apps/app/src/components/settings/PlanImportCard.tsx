import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { parsePlanFile, type ParseResult } from '@tracknow/core/domain/planImport'
import { importPlanFile, type ImportReport } from '@tracknow/core/services/planImportService'
import { Button } from '@/components/ui'

const MAX_FILE_BYTES = 512 * 1024

/**
 * Settings card: import a "tracknow.plan.v1" file (Tracks → Plans → items). Shows a preview first,
 * imports only after an explicit click, and reports exactly what was created.
 */
export function PlanImportCard({ userId }: { userId: string }) {
  const inputId = useId()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const onFile = async (file: File | undefined) => {
    setReport(null)
    setParsed(null)
    setFileName(file?.name ?? null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setParsed({ file: null, errors: ['The file is larger than 512 KB.'], counts: { tracks: 0, plans: 0, items: 0 } })
      return
    }
    setParsed(parsePlanFile(await file.text()))
  }

  const run = async () => {
    if (!parsed?.file || busy) return
    setBusy(true)
    setProgress({ done: 0, total: 1 })
    try {
      setReport(await importPlanFile(userId, parsed.file, (done, total) => setProgress({ done, total })))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="settings-import-heading">
      <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <Upload size={18} aria-hidden="true" />
        <div>
          <h2 id="settings-import-heading" className="t-h2">
            Import a plan
          </h2>
          <p className="t-caption">
            Set up several Tracks, Plans and items at once from a <code>tracknow.plan.v1</code> JSON file. Existing Tracks with the
            same name are reused and Plans that already exist are skipped, so importing twice never duplicates anything.
          </p>
        </div>
      </div>

      <label htmlFor={inputId} className="field__label">
        Plan file (.json)
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        disabled={busy}
        onChange={(e) => void onFile(e.target.files?.[0])}
        style={{ display: 'block', marginTop: '6px' }}
      />

      {parsed && parsed.errors.length > 0 && (
        <div className="alert alert--error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          <strong>{fileName} can’t be imported:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '1.2em' }}>
            {parsed.errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {parsed.errors.length > 8 && <li>…and {parsed.errors.length - 8} more</li>}
          </ul>
        </div>
      )}

      {parsed?.file && !report && (
        <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          <p className="t-caption">
            {parsed.file.title ? <strong>{parsed.file.title}: </strong> : null}
            {parsed.counts.tracks} Tracks, {parsed.counts.plans} Plans, {parsed.counts.items} items.
          </p>
          <ul className="t-meta" style={{ margin: 0, paddingLeft: '1.2em' }}>
            {parsed.file.tracks.map((t) => (
              <li key={t.name}>
                {t.name}: {t.plans.map((p) => p.name).join(', ') || 'no Plans'}
              </li>
            ))}
          </ul>
          <Button variant="primary" onClick={() => void run()} disabled={busy} aria-busy={busy} style={{ alignSelf: 'flex-start' }}>
            {busy && progress ? `Importing… ${progress.done}/${progress.total}` : 'Import into my account'}
          </Button>
        </div>
      )}

      {report && (
        <div className={`alert ${report.error ? 'alert--error' : 'alert--success'}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
          {report.error ? 'Import stopped: ' + report.error + '. ' : 'Imported. '}
          {report.tracksCreated} Tracks created, {report.tracksReused} reused, {report.plansCreated} Plans and {report.itemsCreated} items
          created.
          {report.plansSkipped.length > 0 && ` Skipped (already there): ${report.plansSkipped.join(', ')}.`}{' '}
          <Link to="/today">Open Today</Link>
        </div>
      )}
    </section>
  )
}

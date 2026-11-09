import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Layers } from 'lucide-react'
import { PLAN_LIBRARY, materializeLibraryEntry, type LibraryEntry } from '@tracknow/core/constants/planLibrary'
import { parsePlanFile } from '@tracknow/core/domain/planImport'
import { importPlanFile } from '@tracknow/core/services/planImportService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { track } from '@tracknow/core/services/telemetry'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { usePreferences } from '@/hooks/usePreferences'
import { Badge, Button, Input, Modal, PageHeader } from '@/components/ui'

const CATEGORY_LABEL: Record<LibraryEntry['category'], string> = {
  arc: 'Whole-life Arc',
  routine: 'Routine',
  learning: 'Learning',
  health: 'Health',
  money: 'Money',
  home: 'Home',
  creative: 'Creative',
}

/** The Plan library: ready-made setups you can import in one tap and then change freely. */
export function LibraryPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { terms } = usePreferences()
  const navigate = useNavigate()
  const [open, setOpen] = useState<LibraryEntry | null>(null)
  const [startDate, setStartDate] = useState(getTodayDateString())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const preview = useMemo(() => (open ? parsePlanFile(materializeLibraryEntry(open, startDate)) : null), [open, startDate])

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
    track('template_used', { template: open.key })
    showToast({
      title: `${open.title} is ready`,
      message: `${report.tracksCreated} new ${terms.tracks.toLowerCase()}, ${report.plansCreated} ${terms.plans.toLowerCase()}, ${report.itemsCreated} items.${report.plansSkipped.length ? ` ${report.plansSkipped.length} existing ${terms.plans.toLowerCase()} skipped.` : ''}`,
      type: 'success',
      duration: 9000,
    })
    setOpen(null)
    navigate('/today')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Ready-made setups"
        description={`Pick one, choose a start date, and it becomes real ${terms.tracks}, ${terms.plans} and items you can change freely. Importing the same one twice never duplicates anything.`}
      />
      <div className="grid library-grid">
        {PLAN_LIBRARY.map((e, i) => (
          <article key={e.key} className="card library-card fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="t-h3">{e.title}</h2>
                <p className="t-caption" style={{ margin: 0 }}>
                  {e.tagline}
                </p>
              </div>
              <Badge>{e.lengthDays ? `${e.lengthDays} days` : 'Ongoing'}</Badge>
            </div>
            <p className="t-caption" style={{ margin: 0 }}>
              {e.blurb}
            </p>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <span className="t-meta">{CATEGORY_LABEL[e.category]}</span>
              <Button size="sm" variant="primary" onClick={() => setOpen(e)}>
                <Download size={14} aria-hidden="true" /> Use this
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={Boolean(open)}
        onClose={() => (busy ? undefined : setOpen(null))}
        title={open ? open.title : ''}
        dismissible={!busy}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void run()} disabled={busy || !preview?.file} aria-busy={busy}>
              <Layers size={14} aria-hidden="true" /> {busy ? `Importing… ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Import'}
            </Button>
          </>
        }
      >
        {open && (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <p className="t-caption" style={{ margin: 0 }}>
              {open.blurb}
            </p>
            <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || getTodayDateString())} />
            {preview?.file ? (
              <div className="stack" style={{ gap: 'var(--space-1)' }}>
                <span className="t-meta">
                  {preview.counts.tracks} {terms.tracks} · {preview.counts.plans} {terms.plans} · {preview.counts.items} items
                </span>
                <ul className="library-preview">
                  {preview.file.tracks.map((t) => (
                    <li key={t.name}>
                      <strong>{t.name}</strong>: {t.plans.map((p) => `${p.name} (${p.items.length})`).join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="alert alert--error" role="alert">
                {preview?.errors.join(' ')}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

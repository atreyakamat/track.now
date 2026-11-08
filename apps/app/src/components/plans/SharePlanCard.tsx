import { useEffect, useState } from 'react'
import { Copy, Link2, Users, X } from 'lucide-react'
import { createPlanShare, listPlanShares, revokePlanShare, type PlanShare } from '@tracknow/core/services/shareService'
import { useToast } from '@/features/notifications/ToastContext'
import { Button } from '@/components/ui'

/** Accountability partner: a read-only link to this Plan, revocable any time. */
export function SharePlanCard({ userId, planId }: { userId: string; planId: string }) {
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

  const linkFor = (s: PlanShare) => `${window.location.origin}/share/${s.token}`
  const copy = async (s: PlanShare) => {
    try {
      await navigator.clipboard.writeText(linkFor(s))
      showToast({ title: 'Link copied', message: 'Anyone with it can see this Plan, read-only.', type: 'success' })
    } catch {
      showToast({ title: 'Copy this link', message: linkFor(s), type: 'info', duration: 15000 })
    }
  }
  const create = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const s = await createPlanShare(userId, planId)
      setShares((prev) => [...(prev ?? []), s])
      await copy(s)
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
    <details className="plan-details">
      <summary>
        <Users size={14} aria-hidden="true" /> Share with a partner or coach {shares?.length ? `(${shares.length} active link${shares.length === 1 ? '' : 's'})` : ''}
      </summary>
      <div className="stack" style={{ gap: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
        <p className="t-caption" style={{ margin: 0 }}>
          A read-only page with this Plan’s items and the last 90 days of completions. Nothing else from your account is visible. Revoke a link any time.
        </p>
        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}
        {(shares ?? []).map((s) => (
          <div key={s.id} className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <code className="t-caption" style={{ overflowWrap: 'anywhere', flex: '1 1 200px' }}>
              {linkFor(s)}
            </code>
            <Button size="sm" variant="ghost" onClick={() => void copy(s)} aria-label="Copy link">
              <Copy size={14} aria-hidden="true" /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void revoke(s)} disabled={busy} aria-label="Revoke link">
              <X size={14} aria-hidden="true" /> Revoke
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" onClick={() => void create()} disabled={busy || shares === null}>
            <Link2 size={14} aria-hidden="true" /> {busy ? 'Creating…' : 'Create a share link'}
          </Button>
        </div>
      </div>
    </details>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { deleteMyAccount } from '@tracknow/core/services/accountService'
import { useToast } from '@/features/notifications/ToastContext'
import { Button, Input, Modal } from '@/components/ui'

/** Permanent account deletion: typed confirmation, then the server removes every row. */
export function DeleteAccountCard({ email }: { email: string }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (typed !== 'DELETE' || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteMyAccount()
      showToast({ title: 'Account deleted', message: 'Everything has been removed. Thank you for trying Track.now.', type: 'info', duration: 9000 })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account.')
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="settings-delete-heading" style={{ borderColor: 'var(--danger)' }}>
      <h2 id="settings-delete-heading" className="t-h2 row" style={{ alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <AlertTriangle size={18} aria-hidden="true" /> Delete account
      </h2>
      <p className="t-caption" style={{ marginBottom: 'var(--space-3)' }}>
        Permanently deletes {email}, every Track, Plan, item and completion, and the sign-in itself. Export your data first if you want to keep it. This cannot be undone.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account…
      </Button>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title="Delete your account?"
        dismissible={!busy}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button variant="danger" onClick={() => void run()} disabled={typed !== 'DELETE' || busy} aria-busy={busy}>
              {busy ? 'Deleting…' : 'Delete everything'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          <p className="t-caption" style={{ margin: 0 }}>
            This removes your account and all of its data immediately and permanently. Type <strong>DELETE</strong> to confirm.
          </p>
          <Input label="Confirmation" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="DELETE" autoComplete="off" />
        </div>
      </Modal>
    </section>
  )
}

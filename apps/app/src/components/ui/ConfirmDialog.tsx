import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel = 'Cancel', destructive, busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      // While the confirmed action runs, Escape/backdrop must not hide the dialog.
      onClose={() => {
        if (!busy) onCancel()
      }}
      dismissible={!busy}
      title={title}
      actions={
        <>
          {/* Destructive dialogs focus the safe choice first so a stray Enter cannot delete data. */}
          <Button variant="ghost" onClick={onCancel} disabled={busy} data-autofocus={destructive ? true : undefined}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            data-autofocus={destructive ? undefined : true}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="t-muted">{message}</p>
    </Modal>
  )
}

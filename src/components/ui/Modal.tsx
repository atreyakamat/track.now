import type { ReactNode } from 'react'
import { Overlay } from './Overlay'

export function Modal({
  open, onClose, title, children, actions,
}: { open: boolean; onClose: () => void; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <Overlay open={open} onClose={onClose} label={title} variant="modal">
      <h2 className="t-h2">{title}</h2>
      {children}
      {actions && <div className="modal__actions">{actions}</div>}
    </Overlay>
  )
}

export function Drawer({
  open, onClose, label, children,
}: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return (
    <Overlay open={open} onClose={onClose} label={label} variant="drawer">
      {children}
    </Overlay>
  )
}

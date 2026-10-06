import { Link, type LinkProps } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface CommonProps {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: boolean
}

const cls = ({ variant = 'secondary', size = 'md', block, icon }: CommonProps) =>
  ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', icon && 'btn--icon']
    .filter(Boolean)
    .join(' ')

export function Button({
  variant, size, block, icon, type = 'button', ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cls({ variant, size, block, icon })} {...props} />
}

export function ButtonLink({
  variant, size, block, icon, children, ...props
}: CommonProps & LinkProps & { children: ReactNode }) {
  return (
    <Link className={cls({ variant, size, block, icon })} {...props}>
      {children}
    </Link>
  )
}

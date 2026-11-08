import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { nextRovingIndex } from './Tabs'
import { Eye, EyeOff } from 'lucide-react'
import { checkPassword } from '@tracknow/core/auth/password'

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
}

function FieldShell({ id, label, hint, error, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field__error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}

const describedBy = (id: string, hint?: string, error?: string | null) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined

export function Input({ label, hint, error, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input id={id} className="control" aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} {...props} />
    </FieldShell>
  )
}

/**
 * Password field with a show/hide toggle and an optional strength meter (for new passwords).
 * The toggle never changes the value; the meter never blocks submission.
 */
export function PasswordInput({
  label, hint, error, showStrength, value, ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement> & { showStrength?: boolean; value: string }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const check = showStrength && value ? checkPassword(value) : null
  const strengthId = `${id}-strength`
  const described = [describedBy(id, hint, error), check ? strengthId : undefined].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="password-field">
        <input
          id={id}
          className="control"
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={described}
          value={value}
          spellCheck={false}
          {...props}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {check && (
        <div className="password-strength" id={strengthId} data-score={check.score}>
          <span className="password-strength__meter" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="field__hint">
            {check.label}
            {check.tip ? ` · ${check.tip}` : ''}
          </span>
        </div>
      )}
    </FieldShell>
  )
}

export function Textarea({ label, hint, error, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea id={id} className="control" aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} {...props} />
    </FieldShell>
  )
}

export function Select({
  label, hint, error, children, ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select id={id} className="control" aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} {...props}>
        {children}
      </select>
    </FieldShell>
  )
}

export interface RadioOption {
  value: string
  /** Accessible name (also used as the tooltip). */
  label: string
  content?: ReactNode
  style?: CSSProperties
}

/**
 * Single-select picker with WAI-ARIA radiogroup semantics: only the checked
 * option is in the Tab order (roving tabindex); Arrow keys move and select,
 * Home/End jump to the ends; Space/Enter select via the native button click.
 */
export function RovingRadioGroup({
  labelledBy, options, value, onChange, className, optionClassName,
}: {
  /** id of the visible label element. */
  labelledBy: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  className?: string
  optionClassName?: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const checkedIndex = options.findIndex((option) => option.value === value)
  // With nothing checked, the first option must still be reachable with Tab.
  const tabbableIndex = checkedIndex === -1 ? 0 : checkedIndex

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = nextRovingIndex(event.key, index, options.length, 'both')
    if (target === null) return
    event.preventDefault()
    onChange(options[target].value)
    refs.current[target]?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={className}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => { refs.current[index] = node }}
          type="button"
          role="radio"
          aria-checked={index === checkedIndex}
          aria-label={option.label}
          title={option.label}
          tabIndex={index === tabbableIndex ? 0 : -1}
          className={optionClassName}
          style={option.style}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.content}
        </button>
      ))}
    </div>
  )
}

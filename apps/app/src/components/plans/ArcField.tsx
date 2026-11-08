import { useId } from 'react'
import { Input } from '@/components/ui'
import { ARC_NAME_MAX } from '@tracknow/core/domain/arcs'

/** "Part of an Arc" — free text with suggestions from Arcs already in use. */
export function ArcField({ value, onChange, names }: { value: string; onChange: (v: string) => void; names: string[] }) {
  const listId = useId()
  return (
    <>
      <Input
        label="Part of an Arc (optional)"
        hint="Group Plans from different Tracks under one name, e.g. “Winter Arc 2026”. Leave empty for a standalone Plan."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={ARC_NAME_MAX}
        list={names.length ? listId : undefined}
        autoComplete="off"
      />
      {names.length > 0 && (
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
    </>
  )
}

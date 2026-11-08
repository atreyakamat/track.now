import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { listPlans } from '@tracknow/core/services/plansService'
import { arcNames, ARC_NAME_MAX } from '@tracknow/core/domain/arcs'
import { ChoiceChips, Text, TextField } from '@/components/ui'
import { spacing } from '@/theme/tokens'

/** "Part of an Arc" — free text with the Arc names already in use as one-tap suggestions. */
export function ArcField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [known, setKnown] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    listPlans()
      .then((plans) => alive && setKnown(arcNames(plans)))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return (
    <View style={{ gap: spacing[2] }}>
      <TextField
        label="Part of an Arc (optional)"
        value={value}
        onChangeText={onChange}
        placeholder="e.g. Winter Arc 2026"
        maxLength={ARC_NAME_MAX}
        hint="Group Plans from different Tracks under one name. Leave empty for a standalone Plan."
      />
      {known.length > 0 ? (
        <ChoiceChips options={known.map((n) => ({ value: n, label: n }))} value={value.trim()} onChange={(n) => onChange(value.trim() === n ? '' : n)} />
      ) : null}
    </View>
  )
}

export function OutcomeFields({
  outcome,
  criteria,
  onOutcome,
  onCriteria,
}: {
  outcome: string
  criteria: string
  onOutcome: (v: string) => void
  onCriteria: (v: string) => void
}) {
  return (
    <>
      <TextField
        label="Desired outcome (optional)"
        value={outcome}
        onChangeText={onOutcome}
        placeholder="e.g. A consistent 4-day gym routine plus weekend cardio"
        maxLength={2000}
        multiline
        numberOfLines={2}
        style={{ minHeight: 64, textAlignVertical: 'top' }}
      />
      <TextField
        label="Success criteria (optional)"
        value={criteria}
        onChangeText={onCriteria}
        placeholder="How will you know it worked? One per line."
        maxLength={4000}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
        Both are shown on the Plan and again when you complete it.
      </Text>
    </>
  )
}

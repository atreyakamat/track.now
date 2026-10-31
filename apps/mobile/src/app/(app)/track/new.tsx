import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { createExecutionItem } from '@tracknow/core/services/executionService'
import { createPlan } from '@tracknow/core/services/plansService'
import { createTrack, listTrackTemplates, listTracks } from '@tracknow/core/services/tracksService'
import { checkForDuplicateTrack } from '@tracknow/core/domain/tracks'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import {
  DEFAULT_TRACK_TEMPLATES,
  TRACK_COLORS,
  TRACK_ICONS,
} from '@tracknow/core/constants/trackTemplates'
import type { TemplateType, Track, TrackTemplate } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import { Button, Card, ConfirmDialog, Screen, Text, TextField } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, resolveTrackColor, spacing } from '@/theme/tokens'

const TEMPLATE_ORDER: TemplateType[] = ['fitness', 'finance', 'career', 'learning', 'business', 'custom']

export default function NewTrackScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const [templates, setTemplates] = useState<TrackTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('fitness')
  const [name, setName] = useState('Fitness')
  const [description, setDescription] = useState('Physical health, routines, workouts, sleep, and nutrition.')
  const [icon, setIcon] = useState('Activity')
  const [color, setColor] = useState('#c8f169')
  const [seedStarterPlan, setSeedStarterPlan] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const userTouched = useRef(false)

  const [duplicate, setDuplicate] = useState<Track | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const duplicateConfirmed = useRef(false)

  useEffect(() => {
    listTrackTemplates()
      .then((tpls) => {
        setTemplates(tpls)
        const fitness = tpls.find((t) => t.template_type === 'fitness')
        if (fitness && !userTouched.current) {
          setName(fitness.name)
          setDescription(fitness.description)
          setIcon(fitness.icon)
          setColor(fitness.color)
        }
      })
      .catch(() => setTemplates([]))
  }, [])

  const templateList = templates.length > 0 ? templates : DEFAULT_TRACK_TEMPLATES

  const selectTemplate = (type: TemplateType) => {
    userTouched.current = true
    duplicateConfirmed.current = false
    setSelectedTemplate(type)
    if (type === 'custom') {
      setName('')
      setDescription('')
      setIcon('Target')
      setColor('#c8f169')
      return
    }
    const t = templateList.find((tpl) => (tpl.key || tpl.template_type) === type)
    if (t) {
      setName(t.name)
      setDescription(t.description)
      setIcon(t.icon)
      setColor(t.color)
    }
  }

  const create = async () => {
    if (!user) return
    let seedFailed = false
    try {
      setError(null)
      const track = await createTrack(user.id, {
        name: name.trim(),
        description: description.trim() || null,
        template_key: selectedTemplate !== 'custom' ? selectedTemplate : null,
        template_type: selectedTemplate,
        icon,
        color,
      })

      if (seedStarterPlan && selectedTemplate !== 'custom') {
        const tpl = templateList.find((t) => (t.key || t.template_type) === selectedTemplate)
        if (tpl) {
          try {
            const starterPlan = await createPlan(user.id, {
              track_id: track.id,
              name: `${track.name} Kickoff`,
              description: `Starter plan seeded from ${tpl.name} template`,
              start_date: getTodayDateString(),
              end_date: null,
            })
            const itemsToSeed =
              tpl.default_items && tpl.default_items.length > 0
                ? tpl.default_items
                : [
                    { title: `${track.name} daily routine`, type: 'habit' as const },
                    { title: `Set up ${track.name} system`, type: 'task' as const },
                    { title: 'First month review', type: 'milestone' as const },
                  ]
            for (const item of itemsToSeed) {
              await createExecutionItem(user.id, {
                plan_id: starterPlan.id,
                track_id: track.id,
                name: item.title,
                type: item.type,
                priority: 'medium',
                due_date: null,
                schedule: item.type === 'habit' ? { frequency: 'daily', time_of_day: 'anytime' } : null,
              })
            }
          } catch {
            seedFailed = true
          }
        }
      }

      router.replace(`/track/${track.id}${seedFailed ? '?seed=failed' : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create track')
    }
  }

  const submit = async () => {
    if (busyRef.current) return
    if (!name.trim()) {
      setError('Track name is required.')
      return
    }
    if (name.trim().length > 80) {
      setError('Track name must be 80 characters or fewer.')
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      if (!duplicateConfirmed.current) {
        const check = await checkForDuplicateTrack(listTracks, name, selectedTemplate)
        if (!check.ok) {
          setError(check.error)
          return
        }
        if (check.duplicate) {
          setDuplicate(check.duplicate)
          setShowDuplicate(true)
          return
        }
      }
      await create()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Screen scroll padded={false}>
      <View style={{ paddingHorizontal: spacing[4] }}>
        <AppBar title="New track" />
      </View>
      <View style={{ paddingHorizontal: spacing[4], gap: spacing[4], paddingBottom: spacing[7] }}>
        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: spacing[2] }}>
          <Text variant="meta" tone="tertiary">
            Start from a template
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {TEMPLATE_ORDER.map((type) => {
              const active = selectedTemplate === type
              return (
                <Pressable
                  key={type}
                  onPress={() => selectTemplate(type)}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: active ? colors.focusRing : colors.borderStrong,
                    backgroundColor: active ? colors.surfaceRaised : colors.surface,
                  }}
                >
                  <Text variant="caption" weight={active ? 'semibold' : 'medium'} style={{ textTransform: 'capitalize' }}>
                    {type}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <TrackIcon icon={icon} color={color} size={52} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            Pick an icon and color below, or keep the template defaults.
          </Text>
        </View>

        <TextField label="Name" value={name} onChangeText={setName} placeholder="Track name" maxLength={80} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What is this track about?"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" weight="medium">
            Color
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {TRACK_COLORS.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => {
                  userTouched.current = true
                  setColor(c.value)
                }}
                accessibilityLabel={c.label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.pill,
                  backgroundColor: c.value,
                  borderWidth: 3,
                  borderColor: color === c.value ? colors.focusRing : 'transparent',
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" weight="medium">
            Icon
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {TRACK_ICONS.map((ic) => {
              const active = icon === ic
              return (
                <Pressable
                  key={ic}
                  onPress={() => {
                    userTouched.current = true
                    setIcon(ic)
                  }}
                  style={{
                    padding: 3,
                    borderRadius: radius.md,
                    borderWidth: 2,
                    borderColor: active ? resolveTrackColor(color) : 'transparent',
                  }}
                >
                  <TrackIcon icon={ic} color={color} size={40} />
                </Pressable>
              )
            })}
          </View>
        </View>

        {selectedTemplate !== 'custom' ? (
          <Pressable
            onPress={() => setSeedStarterPlan((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: seedStarterPlan ? colors.controlBg : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {seedStarterPlan ? <Feather name="check" size={16} color={colors.controlText} /> : null}
            </View>
            <Text variant="caption" style={{ flex: 1 }}>
              Seed a starter plan with example habits and tasks
            </Text>
          </Pressable>
        ) : null}

        <Button title={busy ? 'Creating…' : 'Create track'} block loading={busy} onPress={submit} />
      </View>

      <ConfirmDialog
        visible={showDuplicate}
        title="You already have a similar track"
        message={
          duplicate
            ? `A track called "${duplicate.name}" already exists. Create another one anyway?`
            : undefined
        }
        confirmLabel="Create anyway"
        cancelLabel="Keep existing"
        onCancel={() => {
          setShowDuplicate(false)
          if (duplicate) router.replace(`/track/${duplicate.id}`)
        }}
        onConfirm={async () => {
          setShowDuplicate(false)
          duplicateConfirmed.current = true
          setBusy(true)
          busyRef.current = true
          try {
            await create()
          } finally {
            setBusy(false)
            busyRef.current = false
          }
        }}
      />
    </Screen>
  )
}

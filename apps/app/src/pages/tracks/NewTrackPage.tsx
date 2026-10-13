import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { createTrack, listTracks, listTrackTemplates } from '@/services/tracksService'
import { createPlan } from '@/services/plansService'
import { createExecutionItem } from '@/services/executionService'
import { getTodayDateString } from '@/domain/dates'
import type { TemplateType, Track, TrackTemplate } from '@/types/domain'
import {
  DEFAULT_TRACK_TEMPLATES,
  TRACK_COLORS,
  TRACK_ICONS,
} from '@/constants/trackTemplates'
import {
  Button,
  ButtonLink,
  Input,
  Modal,
  PageHeader,
  RovingRadioGroup,
  Textarea,
} from '@/components/ui'
import { TrackIcon } from '@/components/tracks/TrackIcon'

/** An existing Track that the new one would duplicate (same name, or same non-custom template). */
export function findDuplicateTrack(tracks: Track[], name: string, template: TemplateType): Track | null {
  const wanted = name.trim().toLowerCase()
  return (
    tracks.find(
      (t) =>
        t.name.trim().toLowerCase() === wanted ||
        (template !== 'custom' && t.template_type === template),
    ) ?? null
  )
}

export type DuplicateCheckResult =
  | { ok: true; duplicate: Track | null }
  | { ok: false; error: string }

/**
 * Runs the duplicate-name check against a *fresh* Track list at submit time.
 * If the list cannot be loaded the check fails closed (no create), instead of
 * silently treating the user as having no Tracks.
 */
export async function checkForDuplicateTrack(
  loadTracks: () => Promise<Track[]>,
  name: string,
  template: TemplateType,
): Promise<DuplicateCheckResult> {
  try {
    const tracks = await loadTracks()
    return { ok: true, duplicate: findDuplicateTrack(tracks, name, template) }
  } catch (err) {
    const reason = err instanceof Error && err.message ? ` (${err.message})` : ''
    return {
      ok: false,
      error: `Could not check your existing Tracks${reason}, so nothing was created. Please try again.`,
    }
  }
}

export function NewTrackPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<TrackTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('fitness')
  const [name, setName] = useState('Fitness')
  const [description, setDescription] = useState(
    'Physical health, routines, workouts, sleep, and nutrition.',
  )
  const [icon, setIcon] = useState('Activity')
  const [color, setColor] = useState('#c8f169')
  const [suggestedAreas, setSuggestedAreas] = useState<string[]>([])
  const [seedStarterPlan, setSeedStarterPlan] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Synchronous lock: `busy` state lags a render, so double submits could start two creates.
  const busyRef = useRef(false)
  const templateLabelId = useId()
  const colorLabelId = useId()
  const iconLabelId = useId()

  // Duplicate warning state
  const [duplicateMatch, setDuplicateMatch] = useState<Track | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  // Once the user picks a template or edits the form, late-arriving template data must not overwrite it.
  const userTouchedRef = useRef(false)

  useEffect(() => {
    listTrackTemplates()
      .then((tpls) => {
        setTemplates(tpls)
        const fitness = tpls.find((t) => t.template_type === 'fitness')
        if (fitness && !userTouchedRef.current) {
          setName(fitness.name)
          setDescription(fitness.description)
          setIcon(fitness.icon)
          setColor(fitness.color)
          setSuggestedAreas(fitness.suggested_areas || [])
        }
      })
      .catch(() => setTemplates([]))
  }, [])

  const handleSelectTemplate = (type: TemplateType) => {
    userTouchedRef.current = true
    setDuplicateConfirmed(false)
    setSelectedTemplate(type)
    if (type === 'custom') {
      setName('')
      setDescription('')
      setIcon('Target')
      setColor('#c8f169')
      setSuggestedAreas([])
      return
    }

    const t = (templates.length > 0 ? templates : DEFAULT_TRACK_TEMPLATES).find(
      (tpl) => (tpl.key || tpl.template_type) === type,
    )
    if (t) {
      setName(t.name)
      setDescription(t.description)
      setIcon(t.icon)
      setColor(t.color)
      setSuggestedAreas(t.suggested_areas || [])
    }
  }

  /** Runs `task` while holding the busy lock; ignores calls while another is running. */
  const withBusy = async (task: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await task()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** Creates the Track (and optional starter plan). Callers must hold the busy lock. */
  const performCreate = async () => {
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

      // Seed starter plan and items if requested and from a template
      if (seedStarterPlan && selectedTemplate !== 'custom') {
        const tplList = templates.length > 0 ? templates : DEFAULT_TRACK_TEMPLATES
        const tpl = tplList.find((t) => (t.key || t.template_type) === selectedTemplate)
        if (tpl) {
          try {
            const starterPlan = await createPlan(user.id, {
              track_id: track.id,
              name: `${track.name} Kickoff`,
              description: `Starter plan seeded from ${tpl.name} template`,
              start_date: getTodayDateString(),
              end_date: null,
            })

            const itemsToSeed = tpl.default_items && tpl.default_items.length > 0
              ? tpl.default_items
              : [
                  { title: `${track.name} daily routine`, type: 'habit' as const },
                  { title: `Set up ${track.name} system`, type: 'task' as const },
                  { title: `First month review`, type: 'milestone' as const },
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
            // The Track itself exists; tell the user on the next page instead of hiding it.
            seedFailed = true
          }
        }
      }

      navigate(`/tracks/${track.id}?created=true${seedFailed ? '&seed=failed' : ''}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Track')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busyRef.current) return
    if (!name.trim()) {
      setError('Track name is required.')
      return
    }
    if (name.trim().length > 80) {
      setError('Track name must be 80 characters or fewer.')
      return
    }

    void withBusy(async () => {
      setError(null)
      if (!duplicateConfirmed) {
        // Always check against the current list; a failed or not-yet-finished preload must not skip it.
        const check = await checkForDuplicateTrack(listTracks, name, selectedTemplate)
        if (!check.ok) {
          setError(check.error)
          return
        }
        // Duplicate names are allowed, but only after an explicit confirmation.
        if (check.duplicate) {
          setDuplicateMatch(check.duplicate)
          setShowDuplicateModal(true)
          return
        }
      }
      await performCreate()
    })
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/tracks', label: 'All Tracks' }}
        title="Create Track"
        description="Choose a template or build a custom life area."
      />

      {error && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        {/* Step 1: Choose Template */}
        <div>
          <h2 id={templateLabelId} className="field__label" style={{ marginBottom: 'var(--space-3)' }}>
            1. Select a Template
          </h2>
          <div className="template-grid" role="group" aria-labelledby={templateLabelId}>
            {(templates.length > 0 ? templates : DEFAULT_TRACK_TEMPLATES).map((t) => {
              const tKey = (t.key || t.template_type) as TemplateType
              const isSelected = selectedTemplate === tKey
              return (
                <button
                  key={tKey}
                  type="button"
                  className="template"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectTemplate(tKey)}
                >
                  <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span
                      className="icon-chip"
                      style={{ background: t.color, color: '#141414' }}
                      aria-hidden="true"
                    >
                      <TrackIcon name={t.icon} size={20} />
                    </span>
                    {isSelected && <Check size={18} color="var(--text-primary)" aria-hidden="true" />}
                  </span>
                  <span className="template__text">
                    <span className="t-h3 template__name">{t.name}</span>
                    <span className="card__desc" style={{ fontSize: 'var(--text-caption)', marginTop: '2px' }}>
                      {t.description}
                    </span>
                  </span>
                </button>
              )
            })}

            {/* Custom option */}
            <button
              type="button"
              className="template"
              aria-pressed={selectedTemplate === 'custom'}
              onClick={() => handleSelectTemplate('custom')}
            >
              <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                <span
                  className="icon-chip"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
                  aria-hidden="true"
                >
                  <Plus size={20} />
                </span>
                {selectedTemplate === 'custom' && <Check size={18} color="var(--text-primary)" aria-hidden="true" />}
              </span>
              <span className="template__text">
                <span className="t-h3 template__name">Custom Track</span>
                <span className="card__desc" style={{ fontSize: 'var(--text-caption)', marginTop: '2px' }}>
                  Define your own life area, personal domain, or initiative.
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* Step 2: Configure details */}
        <div className="stack" style={{ gap: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
          <h2 className="field__label">2. Configure Track</h2>

          <Input
            label="Track Name"
            placeholder="e.g. Fitness, Career, Wealth, Creativity"
            value={name}
            onChange={(e) => {
              userTouchedRef.current = true
              setDuplicateConfirmed(false)
              setName(e.target.value)
            }}
            maxLength={80}
            required
          />

          <Textarea
            label="Description"
            placeholder="What does excellence look like in this area?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {selectedTemplate !== 'custom' && (
            <div
              className="row"
              style={{
                gap: 'var(--space-2)',
                alignItems: 'center',
                padding: 'var(--space-3)',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <input
                type="checkbox"
                id="seedStarterPlan"
                checked={seedStarterPlan}
                onChange={(e) => setSeedStarterPlan(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label
                htmlFor="seedStarterPlan"
                style={{ cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}
              >
                Seed starter plan and initial execution items from this template
              </label>
            </div>
          )}

          {suggestedAreas.length > 0 && (
            <div>
              <span className="field__label" style={{ marginBottom: '6px', display: 'block' }}>
                Suggested Areas
              </span>
              <div className="chips">
                {suggestedAreas.map((area) => (
                  <span key={area} className="badge">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <span id={colorLabelId} className="field__label" style={{ marginBottom: '8px', display: 'block' }}>
              Accent Color
            </span>
            <RovingRadioGroup
              labelledBy={colorLabelId}
              className="swatches"
              optionClassName="swatch"
              value={color}
              onChange={setColor}
              options={TRACK_COLORS.map((swatch) => ({
                value: swatch.value,
                label: swatch.label,
                style: { '--swatch': swatch.value } as React.CSSProperties,
              }))}
            />
          </div>

          <div>
            <span id={iconLabelId} className="field__label" style={{ marginBottom: '8px', display: 'block' }}>
              Icon
            </span>
            <RovingRadioGroup
              labelledBy={iconLabelId}
              className="icon-picker"
              optionClassName="icon-option"
              value={icon}
              onChange={setIcon}
              options={TRACK_ICONS.map((iconName) => ({
                value: iconName,
                label: iconName,
                content: <TrackIcon name={iconName} size={18} aria-hidden="true" />,
              }))}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Button type="submit" variant="primary" disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'Creating Track…' : 'Create Track'}
          </Button>
          <ButtonLink to="/tracks" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>

      {/* Duplicate track confirmation modal */}
      {duplicateMatch && (
        <Modal
          open={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          title="Track Already Exists"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => setShowDuplicateModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDuplicateModal(false)
                  setDuplicateConfirmed(true)
                  void withBusy(performCreate)
                }}
              >
                Create Another Track
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowDuplicateModal(false)
                  navigate(`/tracks/${duplicateMatch.id}`)
                }}
              >
                Use Existing Track
              </Button>
            </>
          }
        >
          <p className="t-muted">
            You already have an existing <strong>{duplicateMatch.name}</strong> Track.
            Would you like to use your existing Track or continue creating another one?
          </p>
        </Modal>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { createTrack, listTracks } from '@/services/tracksService'
import type { TemplateType, Track } from '@/types/domain'
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
  Textarea,
} from '@/components/ui'
import { TrackIcon } from '@/components/tracks/TrackIcon'

export function NewTrackPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [existingTracks, setExistingTracks] = useState<Track[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('fitness')
  const [name, setName] = useState('Fitness')
  const [description, setDescription] = useState(
    'Physical health, routines, workouts, sleep, and nutrition.',
  )
  const [icon, setIcon] = useState('Activity')
  const [color, setColor] = useState('#c8f169')
  const [suggestedAreas, setSuggestedAreas] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Duplicate warning state
  const [duplicateMatch, setDuplicateMatch] = useState<Track | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

  useEffect(() => {
    listTracks()
      .then((tracks) => setExistingTracks(tracks))
      .catch((err) => console.error('Could not prefetch tracks:', err))
  }, [])

  const handleSelectTemplate = (type: TemplateType) => {
    setSelectedTemplate(type)
    if (type === 'custom') {
      setName('')
      setDescription('')
      setIcon('Target')
      setColor('#c8f169')
      setSuggestedAreas([])
      return
    }

    const t = DEFAULT_TRACK_TEMPLATES.find((tpl) => tpl.template_type === type)
    if (t) {
      setName(t.name)
      setDescription(t.description)
      setIcon(t.icon)
      setColor(t.color)
      setSuggestedAreas(t.suggested_areas)
    }
  }

  const performCreate = async () => {
    if (!user) return
    try {
      setBusy(true)
      setError(null)
      const track = await createTrack(user.id, {
        name: name.trim(),
        description: description.trim() || null,
        template_type: selectedTemplate,
        icon,
        color,
      })
      navigate(`/tracks/${track.id}?created=true`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Track')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Track name is required.')
      return
    }

    // Check for duplicate track by name or template
    const match = existingTracks.find(
      (t) =>
        t.name.trim().toLowerCase() === name.trim().toLowerCase() ||
        (selectedTemplate !== 'custom' && t.template_type === selectedTemplate),
    )

    if (match && !duplicateMatch) {
      setDuplicateMatch(match)
      setShowDuplicateModal(true)
      return
    }

    performCreate()
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/tracks', label: 'All Tracks' }}
        title="Create Track"
        description="Choose a template or build a custom life area."
      />

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        {/* Step 1: Choose Template */}
        <div>
          <label className="field__label" style={{ marginBottom: 'var(--space-3)', display: 'block' }}>
            1. Select a Template
          </label>
          <div className="template-grid">
            {DEFAULT_TRACK_TEMPLATES.map((t) => {
              const isSelected = selectedTemplate === t.template_type
              return (
                <button
                  key={t.template_type}
                  type="button"
                  className="template"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectTemplate(t.template_type as TemplateType)}
                >
                  <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <div
                      className="icon-chip"
                      style={{ background: t.color, color: '#141414' }}
                      aria-hidden="true"
                    >
                      <TrackIcon name={t.icon} size={20} />
                    </div>
                    {isSelected && <Check size={18} color="var(--text-primary)" />}
                  </div>
                  <div>
                    <h3 className="t-h3">{t.name}</h3>
                    <p className="card__desc" style={{ fontSize: 'var(--text-caption)', marginTop: '2px' }}>
                      {t.description}
                    </p>
                  </div>
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
              <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div
                  className="icon-chip"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
                  aria-hidden="true"
                >
                  <Plus size={20} />
                </div>
                {selectedTemplate === 'custom' && <Check size={18} color="var(--text-primary)" />}
              </div>
              <div>
                <h3 className="t-h3">Custom Track</h3>
                <p className="card__desc" style={{ fontSize: 'var(--text-caption)', marginTop: '2px' }}>
                  Define your own life area, personal domain, or initiative.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Configure details */}
        <div className="stack" style={{ gap: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
          <label className="field__label" style={{ display: 'block' }}>
            2. Configure Track
          </label>

          <Input
            label="Track Name"
            placeholder="e.g. Fitness, Career, Wealth, Creativity"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="What does excellence look like in this area?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

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
            <label className="field__label" style={{ marginBottom: '8px', display: 'block' }}>
              Accent Color
            </label>
            <div className="swatches" role="radiogroup" aria-label="Accent Color">
              {TRACK_COLORS.map((swatch) => (
                <button
                  key={swatch.key}
                  type="button"
                  role="radio"
                  aria-checked={color === swatch.value}
                  className="swatch"
                  style={{ '--swatch': swatch.value } as React.CSSProperties}
                  onClick={() => setColor(swatch.value)}
                  title={swatch.label}
                  aria-label={swatch.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="field__label" style={{ marginBottom: '8px', display: 'block' }}>
              Icon
            </label>
            <div className="icon-picker" role="radiogroup" aria-label="Track Icon">
              {TRACK_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  role="radio"
                  aria-checked={icon === iconName}
                  className="icon-option"
                  onClick={() => setIcon(iconName)}
                  title={iconName}
                  aria-label={iconName}
                >
                  <TrackIcon name={iconName} size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Button type="submit" variant="primary" disabled={busy}>
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
                  performCreate()
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

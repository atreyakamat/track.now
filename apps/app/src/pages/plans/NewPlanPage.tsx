import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { getTrack } from '@tracknow/core/services/tracksService'
import { createPlan, listPlans } from '@tracknow/core/services/plansService'
import { arcNames } from '@tracknow/core/domain/arcs'
import { ArcField } from '@/components/plans/ArcField'
import type { PlanKind, Track } from '@tracknow/core/types/domain'
import { ARC_DURATION_PRESETS, arcEndDate } from '@tracknow/core/domain/plans'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import { useToast } from '@/features/notifications/ToastContext'
import { SearchX } from 'lucide-react'
import { Button, ButtonLink, EmptyState, ErrorState, Input, LoadingState, PageHeader, Textarea } from '@/components/ui'
import { getTodayDateString } from '@tracknow/core/domain/dates'

/** Track ids are UUIDs; anything else cannot exist, so treat it as not-found instead of a server error. */
const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function NewPlanPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useToast()
  const [kind, setKind] = useState<PlanKind>(params.get('kind') === 'ongoing' ? 'ongoing' : 'time_bound')
  const [days, setDays] = useState<number | 'custom'>(90)
  const [outcome, setOutcome] = useState('')
  const [criteria, setCriteria] = useState('')
  const [arcName, setArcName] = useState(params.get('arc') ?? '')
  const [knownArcs, setKnownArcs] = useState<string[]>([])

  const [track, setTrack] = useState<Track | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(getTodayDateString())
  const [customEnd, setCustomEnd] = useState('')
  const endDate =
    kind === 'ongoing' ? '' : days === 'custom' ? customEnd : startDate ? arcEndDate(startDate, days) : ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Loading the parent Track: 'missing' = deleted / not visible; loadError = network/server failure (retryable).
  const [trackMissing, setTrackMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const requestRef = useRef(0)

  const loadTrack = async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setLoadError(null)
    setTrackMissing(false)
    if (!trackId || !RECORD_ID_RE.test(trackId)) {
      setTrack(null)
      setTrackMissing(true)
      setLoading(false)
      return
    }
    try {
      const t = await getTrack(trackId)
      if (requestId !== requestRef.current) return
      setTrack(t)
      setTrackMissing(!t)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setTrack(null)
      setLoadError(err instanceof Error ? err.message : 'Failed to load the Track')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  // Arc suggestions are a convenience; failing to load them never blocks creating a Plan.
  useEffect(() => {
    let alive = true
    listPlans()
      .then((plans) => alive && setKnownArcs(arcNames(plans)))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    void loadTrack()
    return () => {
      requestRef.current += 1
    }
  }, [trackId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busyRef.current || !track) return
    if (!name.trim()) {
      setError('Plan name is required.')
      return
    }
    if (name.trim().length > 120) {
      setError('Plan name must be 120 characters or fewer.')
      return
    }
    if (kind === 'time_bound' && !endDate) {
      setError(startDate ? 'Choose when this Arc ends.' : 'An Arc needs a start date.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('The target end date cannot be before the start date.')
      return
    }
    if (!trackId || !user) return

    try {
      busyRef.current = true
      setBusy(true)
      setError(null)
      const plan = await createPlan(user.id, {
        track_id: trackId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        plan_kind: kind,
        outcome: outcome.trim() || null,
        success_criteria: criteria.trim() || null,
        arc_name: arcName.trim() || null,
      })
      if ((outcome.trim() || criteria.trim() || arcName.trim()) && isLegacySchema()) {
        showToast({ id: 'needs-migration', title: 'Plan created', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
      }
      navigate(`/tracks/${trackId}/plans/${plan.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading track context…" />

  if (trackMissing) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'All Tracks' }} title="Create Plan" />
        <EmptyState
          icon={<SearchX size={20} />}
          title="Track not found"
          description="It may have been deleted, or you may not have access to it, so a Plan cannot be added here."
          action={
            <ButtonLink to="/tracks" variant="primary">
              Back to Tracks
            </ButtonLink>
          }
        />
      </div>
    )
  }

  if (loadError || !track) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'All Tracks' }} title="Create Plan" />
        <ErrorState
          title="Could not load the Track"
          message={loadError || 'Please try again.'}
          onRetry={() => void loadTrack()}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        back={{ to: `/tracks/${track.id}`, label: track.name }}
        eyebrow={`${track.name} Track`}
        title="Create Plan"
        description="An Arc is a focused period with an end date (30, 60 or 90 days). An ongoing Plan keeps going until you finish or pause it."
      />

      {error && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        <fieldset className="choice-group">
          <legend className="field__label">Type of Plan</legend>
          <div className="choice-group__options">
            <label className={`choice${kind === 'time_bound' ? ' choice--on' : ''}`}>
              <input type="radio" name="kind" checked={kind === 'time_bound'} onChange={() => setKind('time_bound')} />
              <span className="choice__title">Arc</span>
              <span className="choice__desc">A set number of days, e.g. a 90-day Winter Arc</span>
            </label>
            <label className={`choice${kind === 'ongoing' ? ' choice--on' : ''}`}>
              <input type="radio" name="kind" checked={kind === 'ongoing'} onChange={() => setKind('ongoing')} />
              <span className="choice__title">Ongoing</span>
              <span className="choice__desc">No end date, e.g. laundry or reading routines</span>
            </label>
          </div>
        </fieldset>

        <Input
          label="Plan name"
          placeholder={kind === 'ongoing' ? 'e.g. Household routine, Keep fit' : 'e.g. Winter Arc, 90-Day Fitness Arc'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          maxLength={120}
        />

        <Textarea
          label="Purpose (optional)"
          placeholder="Why does this Plan matter?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />

        <div className="grid grid--2">
          <Input
            label={kind === 'ongoing' ? 'Start date (optional)' : 'Start date'}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {kind === 'time_bound' && (
            <div className="field">
              <span className="field__label">Length</span>
              <div className="row" role="group" aria-label="Arc length" style={{ gap: '6px', flexWrap: 'wrap' }}>
                {ARC_DURATION_PRESETS.filter((d) => d <= 180).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn--sm ${days === d ? 'btn--primary' : 'btn--secondary'}`}
                    aria-pressed={days === d}
                    onClick={() => setDays(d)}
                  >
                    {d} days
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn btn--sm ${days === 'custom' ? 'btn--primary' : 'btn--secondary'}`}
                  aria-pressed={days === 'custom'}
                  onClick={() => {
                    setDays('custom')
                    setCustomEnd(endDate)
                  }}
                >
                  Custom
                </button>
              </div>
              {days !== 'custom' && endDate && (
                <span className="field__hint">
                  Ends {new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          )}
        </div>
        {kind === 'time_bound' && days === 'custom' && (
          <Input label="End date" type="date" value={customEnd} min={startDate || undefined} onChange={(e) => setCustomEnd(e.target.value)} />
        )}

        <ArcField value={arcName} onChange={setArcName} names={knownArcs} />

        <Textarea
          label="Desired outcome (optional)"
          placeholder="e.g. A consistent 4-day gym routine plus weekend cardio"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          maxLength={2000}
        />
        <Textarea
          label="Success criteria (optional)"
          placeholder="How will you know it worked? e.g. 40+ gym sessions, no missed week"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          maxLength={4000}
        />

        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating Plan…' : 'Create Plan'}
          </Button>
          <ButtonLink to={`/tracks/${track.id}`} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  )
}

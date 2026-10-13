import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { getTrack } from '@/services/tracksService'
import { createPlan } from '@/services/plansService'
import type { Track } from '@/types/domain'
import { SearchX } from 'lucide-react'
import { Button, ButtonLink, EmptyState, ErrorState, Input, LoadingState, PageHeader, Textarea } from '@/components/ui'
import { getTodayDateString } from '@/domain/dates'

/** Track ids are UUIDs; anything else cannot exist, so treat it as not-found instead of a server error. */
const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function NewPlanPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [track, setTrack] = useState<Track | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(getTodayDateString())
  const [endDate, setEndDate] = useState('')
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
      })
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
        description="A Plan is a defined period or arc of execution (e.g. Winter Arc, Q4 Sprint, 30-Day Reset)."
      />

      {error && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        <Input
          label="Plan Name"
          placeholder="e.g. Winter Arc, FDE Preparation, Marathon Sprint"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <Textarea
          label="Objective / Description"
          placeholder="What is the goal of this execution arc?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid--2">
          <Input
            label="Start Date (Optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Target End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

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

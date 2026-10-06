import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { getTrack } from '@/services/tracksService'
import { createPlan } from '@/services/plansService'
import type { Track } from '@/types/domain'
import { Button, ButtonLink, Input, LoadingState, PageHeader, Textarea } from '@/components/ui'
import { getTodayDateString } from '@/domain/dates'

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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!trackId) return
    getTrack(trackId)
      .then((t) => setTrack(t))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [trackId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Plan name is required.')
      return
    }
    if (!trackId || !user) return

    try {
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
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading track context…" />

  return (
    <div>
      <PageHeader
        back={{
          to: trackId ? `/tracks/${trackId}` : '/tracks',
          label: track ? track.name : 'Track',
        }}
        eyebrow={track ? `${track.name} Track` : undefined}
        title="Create Plan"
        description="A Plan is a defined period or arc of execution (e.g. Winter Arc, Q4 Sprint, 30-Day Reset)."
      />

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

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
          <ButtonLink
            to={trackId ? `/tracks/${trackId}` : '/tracks'}
            variant="ghost"
          >
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  )
}

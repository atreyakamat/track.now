import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { GOAL_TEMPLATES, SIGNUP_TEMPLATE_KEYS, buildGoalItemInput, goalItemReminderTime } from '@tracknow/core/constants/goalTemplates'
import { createTrack } from '@tracknow/core/services/tracksService'
import { createPlan } from '@tracknow/core/services/plansService'
import { createExecutionItem } from '@tracknow/core/services/executionService'
import { setReminderForItem } from '@tracknow/core/services/reminderService'
import { parseQuickAdd } from '@tracknow/core/domain/quickAdd'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { track as trackEvent } from '@tracknow/core/services/telemetry'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { usePreferences } from '@/hooks/usePreferences'
import { Button, Input, PageHeader } from '@/components/ui'
import { TrackIcon } from '@/components/tracks/TrackIcon'

/**
 * The first five minutes: pick a ready-made setup (one tap gives a Track, a Plan and 4–6 items),
 * or start with a single habit and learn the structure later.
 */
export function StartPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { terms } = usePreferences()
  const navigate = useNavigate()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [habitText, setHabitText] = useState('')
  const templates = SIGNUP_TEMPLATE_KEYS.map((k) => GOAL_TEMPLATES.find((g) => g.key === k)!).filter(Boolean)
  const parsed = habitText.trim() ? parseQuickAdd(habitText) : null

  const useTemplate = async (key: string) => {
    const t = GOAL_TEMPLATES.find((g) => g.key === key)
    if (!t || !user || busyKey) return
    setBusyKey(key)
    try {
      const track = await createTrack(user.id, { name: t.track.name, description: t.track.description, icon: t.icon, color: t.color, template_type: t.category })
      const plan = await createPlan(user.id, { track_id: track.id, name: t.plan.name, description: t.plan.description, start_date: getTodayDateString(), end_date: null, plan_kind: 'ongoing' })
      for (const item of t.items) {
        const created = await createExecutionItem(user.id, buildGoalItemInput(item, { planId: plan.id, trackId: track.id }))
        if (goalItemReminderTime(item)) {
          try {
            setReminderForItem(user.id, created, 'scheduled_time')
          } catch {
            /* reminders are optional */
          }
        }
      }
      trackEvent('template_used', { template: t.key })
      showToast({ title: `${t.track.name} is set up`, message: `${t.items.length} items are waiting on Today.`, type: 'success' })
      navigate('/today', { replace: true })
    } catch (err) {
      showToast({ title: 'Could not set this up', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
      setBusyKey(null)
    }
  }

  const addOneHabit = async () => {
    if (!user || !parsed?.name || busyKey) return
    setBusyKey('habit')
    try {
      const track = await createTrack(user.id, { name: 'Personal', description: 'Everyday life.', icon: 'Heart', color: '#ec4899', template_type: 'custom' })
      const plan = await createPlan(user.id, { track_id: track.id, name: 'Daily routine', description: null, start_date: getTodayDateString(), end_date: null, plan_kind: 'ongoing' })
      const created = await createExecutionItem(user.id, {
        plan_id: plan.id,
        track_id: track.id,
        type: 'habit',
        name: parsed.name,
        priority: parsed.priority,
        target_count: parsed.targetCount ?? 1,
        unit: parsed.unit,
        schedule: {
          frequency: parsed.timesPerWeek ? 'weekly' : parsed.daysOfWeek && parsed.daysOfWeek.length < 7 ? 'weekly' : 'daily',
          days_of_week: parsed.timesPerWeek ? null : parsed.daysOfWeek && parsed.daysOfWeek.length < 7 ? parsed.daysOfWeek : null,
          time_of_day: parsed.timeOfDay,
          reminder_time: parsed.time,
          times_per_week: parsed.timesPerWeek,
        },
      })
      if (parsed.time) {
        try {
          setReminderForItem(user.id, created, 'scheduled_time')
        } catch {
          /* optional */
        }
      }
      showToast({ title: 'Your first habit is on Today', message: 'It lives in Personal → Daily routine. Change that any time.', type: 'success' })
      navigate('/today', { replace: true })
    } catch (err) {
      showToast({ title: 'Could not add the habit', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
      setBusyKey(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Welcome"
        title="How do you want to start?"
        description={`Pick a ready-made setup, or add one habit. Everything can be changed later. ${terms.hierarchy}`}
      />

      <section className="section" aria-labelledby="start-templates">
        <div className="section__head">
          <h2 id="start-templates" className="t-h2">
            One tap, ready to go
          </h2>
        </div>
        <div className="grid start-grid">
          {templates.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className="card start-card fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => void useTemplate(t.key)}
              disabled={Boolean(busyKey)}
              aria-busy={busyKey === t.key}
            >
              <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                <span className="start-card__icon" style={{ background: t.color }} aria-hidden="true">
                  <TrackIcon name={t.icon} size={20} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <span className="t-h3" style={{ display: 'block' }}>
                    {t.goal}
                  </span>
                  <span className="t-caption">{t.summary}</span>
                </div>
              </div>
              <ul className="start-card__items">
                {t.items.slice(0, 4).map((it) => (
                  <li key={it.key}>
                    <span className="badge">{it.type}</span> {it.name}
                  </li>
                ))}
                {t.items.length > 4 && <li className="t-caption">+{t.items.length - 4} more</li>}
              </ul>
              <span className="start-card__cta">
                {busyKey === t.key ? 'Setting up…' : 'Use this'} <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="start-one-habit">
        <div className="section__head">
          <h2 id="start-one-habit" className="t-h2">
            Or just one habit
          </h2>
        </div>
        <div className="card stack" style={{ gap: 'var(--space-3)' }}>
          <Input
            label="What do you want to do regularly?"
            placeholder="e.g. Walk 20 min every morning · Gym Mon Wed Fri 6am · Read 10 pages at night"
            value={habitText}
            onChange={(e) => setHabitText(e.target.value)}
            hint={parsed?.recognised.length ? `Understood: ${parsed.recognised.join(', ')}` : 'Plain words work. Days, times and “3× a week” are picked up.'}
          />
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => void addOneHabit()} disabled={!parsed?.name || Boolean(busyKey)}>
              <Sparkles size={16} aria-hidden="true" /> Add it to Today
            </Button>
            <Link to="/library" className="btn btn--secondary">
              Browse the Plan library
            </Link>
            <Link to="/today" className="btn btn--ghost">
              Skip for now
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

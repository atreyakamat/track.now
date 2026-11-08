import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { QUEST_XP } from '@tracknow/core/domain/quests'

/**
 * A short, gamified tour: six screens, each with a small illustration, a progress trail and
 * one idea. Finishing it completes the "Take the tour" quest (local flag) and the Explorer
 * achievement. It never blocks anything: Skip is always available.
 */

interface Step {
  title: string
  body: string
  art: JSX.Element
}

const stroke = 'var(--text-primary)'
const lime = '#c8f169'
const muted = 'var(--border-strong, var(--border))'

const STEPS: Step[] = [
  {
    title: 'One place for your whole life',
    body: 'Tracks are the areas you care about: Health, Work, Money, Home… Each Track holds Plans; each Plan holds the habits, tasks, checklists and milestones you actually do.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${20 + i * 70} 22)`}>
            <rect width="60" height="76" rx="10" fill="none" stroke={stroke} strokeWidth="2" />
            <rect x="10" y="12" width="40" height="8" rx="4" fill={i === 1 ? lime : muted} />
            <rect x="10" y="28" width="40" height="6" rx="3" fill={muted} />
            <rect x="10" y="40" width="28" height="6" rx="3" fill={muted} />
            <rect x="10" y="52" width="34" height="6" rx="3" fill={muted} />
          </g>
        ))}
      </svg>
    ),
  },
  {
    title: 'Arcs: 30, 60 or 90 days with a purpose',
    body: 'A Plan with an end date is an Arc. Give Arcs from different Tracks the same name — “Winter Arc 2026” — and they show up together with Day X of N, progress and retention.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        <path d="M30 95 A90 90 0 0 1 210 95" fill="none" stroke={muted} strokeWidth="10" strokeLinecap="round" />
        <path d="M30 95 A90 90 0 0 1 150 23" fill="none" stroke={lime} strokeWidth="10" strokeLinecap="round" />
        <circle cx="150" cy="23" r="9" fill={stroke} />
        <text x="120" y="92" textAnchor="middle" fontSize="16" fontWeight="700" fill={stroke}>Day 42 of 90</text>
      </svg>
    ),
  },
  {
    title: 'Today is home',
    body: 'Everything due across all Tracks lands on Today. Star up to three items as your Focus. Habits on their days, “3× a week” habits whenever, and nothing before its start date.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(30 ${14 + i * 25})`}>
            <rect width="180" height="18" rx="6" fill="none" stroke={i === 0 ? lime : muted} strokeWidth="2" />
            <circle cx="12" cy="9" r="5" fill={i < 2 ? lime : 'none'} stroke={stroke} strokeWidth="1.5" />
            <rect x="26" y="6" width={90 - i * 12} height="6" rx="3" fill={muted} />
            {i === 0 && <path d="M160 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" fill={lime} />}
          </g>
        ))}
      </svg>
    ),
  },
  {
    title: 'Points come only from doing',
    body: 'Completing a habit earns 10 XP, a task 15, a milestone 50. Un-complete it and the points vanish. Creating or editing earns nothing, and a missed day never costs you anything.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        <rect x="30" y="52" width="180" height="14" rx="7" fill={muted} />
        <rect x="30" y="52" width="110" height="14" rx="7" fill={lime} />
        <text x="30" y="40" fontSize="13" fontWeight="700" fill={stroke}>Level 2 · Building Momentum</text>
        <text x="210" y="88" textAnchor="end" fontSize="12" fill={stroke}>320 / 450 XP</text>
        <g transform="translate(150 10)">
          <rect width="58" height="22" rx="11" fill={stroke} />
          <text x="29" y="15" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--surface)">+15 XP</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'Momentum, streaks and retention',
    body: 'Momentum is your last 14 days of habit adherence and active days. Analytics shows whether you are keeping, slipping on or dropping each habit, week by week. Honest numbers, no shame.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        {[40, 55, 70, 65, 85, 90, 72, 95].map((h, i) => (
          <rect key={i} x={30 + i * 24} y={105 - h * 0.8} width="14" height={h * 0.8} rx="4" fill={h < 70 ? muted : lime} />
        ))}
        <line x1="24" y1={105 - 70 * 0.8} x2="220" y2={105 - 70 * 0.8} stroke={stroke} strokeDasharray="4 4" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: 'Review, then start the next Arc',
    body: 'When an Arc reaches its end date it is flagged for review, never closed for you. Write what happened, what you learned, what you decide next, and start the next Arc from there.',
    art: (
      <svg viewBox="0 0 240 120" className="tour__art" aria-hidden="true">
        <rect x="40" y="18" width="160" height="84" rx="12" fill="none" stroke={stroke} strokeWidth="2" />
        <rect x="56" y="34" width="70" height="8" rx="4" fill={lime} />
        <rect x="56" y="50" width="128" height="6" rx="3" fill={muted} />
        <rect x="56" y="62" width="110" height="6" rx="3" fill={muted} />
        <rect x="56" y="74" width="90" height="6" rx="3" fill={muted} />
        <path d="M150 84l10 10 22-22" fill="none" stroke={lime} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function OnboardingTour({ open, onClose, onFinish }: { open: boolean; onClose: () => void; onFinish: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (open) setStep(0)
  }, [open])
  const last = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current.title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => {
              if (last) onFinish()
              else setStep((s) => s + 1)
            }}
          >
            {last ? (
              <>
                <Sparkles size={16} aria-hidden="true" /> Finish · +{QUEST_XP} XP
              </>
            ) : (
              <>
                Next <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="tour" aria-live="polite">
        {current.art}
        <p>{current.body}</p>
        <ol className="tour__trail" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={`tour__dot${i < step ? ' tour__dot--done' : ''}${i === step ? ' tour__dot--current' : ''}`}>
              <span className="sr-only">
                {s.title}
                {i < step ? ' (done)' : i === step ? ' (current)' : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  )
}

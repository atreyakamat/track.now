import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FolderKanban,
  Layers,
  Menu,
  Moon,
  Repeat,
  Shield,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { ProgressCircle } from '../components/ProgressCircle'

const APP_URL = (import.meta.env.VITE_APP_URL as string) || 'https://trackapp.atreyakamat.dev'
const SIGNUP_URL = `${APP_URL}/signup`
const LOGIN_URL = `${APP_URL}/login`

export function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activePreviewTab, setActivePreviewTab] = useState<'today' | 'track' | 'plan'>('today')

  // Interactive mock state for the live preview tab
  const [demoItems, setDemoItems] = useState([
    {
      id: 'demo-1',
      title: '5km Morning Zone-2 Run',
      type: 'habit',
      priority: 'medium',
      schedule: 'Daily · Morning',
      done: true,
    },
    {
      id: 'demo-2',
      title: 'Deep Work: Core Architecture Pass',
      type: 'task',
      priority: 'urgent',
      due: 'Today',
      done: false,
    },
    {
      id: 'demo-3',
      title: 'Weekly Budget Reconciliation',
      type: 'task',
      priority: 'high',
      due: 'Today',
      done: false,
    },
    {
      id: 'demo-4',
      title: 'Read 25 Pages of Philosophy',
      type: 'habit',
      priority: 'low',
      schedule: 'Daily · Evening',
      done: false,
    },
  ])

  const toggleDemoItem = (id: string) => {
    setDemoItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )
  }

  const demoCompletedCount = demoItems.filter((i) => i.done).length
  const demoPercent = Math.round((demoCompletedCount / demoItems.length) * 100)

  return (
    <div className="landing">
      {/* 1. STICKY NAVIGATION */}
      <header className="landing__nav" role="banner">
        <div className="landing__nav-inner">
          <a href="/" className="landing__brand" aria-label="Track.now home">
            <div className="landing__brand-mark" aria-hidden="true">
              T
            </div>
            <span>Track.now</span>
          </a>

          <nav className="landing__nav-links" aria-label="Main navigation">
            <a href="#problem" className="landing__nav-link">
              Problem
            </a>
            <a href="#how-it-works" className="landing__nav-link">
              How It Works
            </a>
            <a href="#tracks-plans" className="landing__nav-link">
              Tracks & Arcs
            </a>
            <a href="#today-view" className="landing__nav-link">
              Today View
            </a>
            <a href="#telemetry" className="landing__nav-link">
              Truthful Telemetry
            </a>
            <a href="#preview" className="landing__nav-link">
              Preview
            </a>
          </nav>

          <div className="landing__nav-actions">
            <button
              type="button"
              className="btn btn--icon btn--ghost"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
              aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <a href={LOGIN_URL} className="btn btn--ghost btn--sm landing__nav-signin">
              Sign In
            </a>
            <a href={SIGNUP_URL} className="btn btn--primary btn--sm landing__nav-cta">
              <span>Get Started</span>
              <ArrowRight size={14} />
            </a>

            <button
              type="button"
              className="landing__mobile-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="landing__mobile-menu" role="dialog" aria-label="Mobile Navigation">
            <a
              href="#problem"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Problem
            </a>
            <a
              href="#how-it-works"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a
              href="#tracks-plans"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tracks & Arcs
            </a>
            <a
              href="#today-view"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Today View
            </a>
            <a
              href="#telemetry"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Truthful Telemetry
            </a>
            <a
              href="#preview"
              className="landing__nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Preview
            </a>
            <div className="row" style={{ marginTop: 'var(--space-2)', gap: 'var(--space-2)' }}>
              <a
                href={LOGIN_URL}
                className="btn btn--secondary"
                style={{ flex: 1 }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </a>
              <a
                href={SIGNUP_URL}
                className="btn btn--primary"
                style={{ flex: 1 }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign Up
              </a>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="landing__hero">
        <div className="landing__pill">
          <span className="landing__pill-dot" aria-hidden="true" />
          <span>TRACK · PLAN · EXECUTE · VERIFY</span>
        </div>

        <h1 className="landing__hero-title">Your life, organized to execute.</h1>

        <p className="landing__hero-subtitle">
          Traditional productivity collapses under disconnected to-do lists and isolated habit
          trackers. Track.now unifies your persistent life domains into focused execution arcs,
          scheduled daily routines, and mathematical progress telemetry. No guilt. No fake
          streaks. Pure execution.
        </p>

        <div className="landing__cta-row">
          <a href={SIGNUP_URL} className="landing__btn-hero-primary">
            <span>Start Building Your System</span>
            <ArrowRight size={18} />
          </a>
          <a href="#how-it-works" className="landing__btn-hero-secondary">
            <span>See How It Works</span>
          </a>
        </div>

        {/* Hero Interactive Frame */}
        <div className="landing__preview-frame" aria-label="Track.now interface mockup">
          <div className="landing__preview-bar">
            <div className="landing__preview-dots" aria-hidden="true">
              <span className="landing__preview-dot" />
              <span className="landing__preview-dot" />
              <span className="landing__preview-dot" />
            </div>
            <span className="landing__preview-url">
              trackapp.atreyakamat.dev/dashboard
            </span>
            <div style={{ width: '42px' }} />
          </div>

          <div className="landing__preview-content">
            {/* Header snippet inside mockup */}
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                <span className="t-meta">Active Workspace · Sprint 04</span>
                <h2 className="t-h1" style={{ marginTop: '4px' }}>
                  Winter Arc 2026
                </h2>
                <p className="t-caption">
                  Execution arc: Oct 01, 2026 – Dec 31, 2026 · Fitness & Deep Work
                </p>
              </div>
              <div
                className="row"
                style={{
                  background: 'var(--surface-muted)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  gap: 'var(--space-3)',
                }}
              >
                <ProgressCircle percent={68} size={48} color="#c8f169" label="Arc completion" />
                <div>
                  <span className="t-h3" style={{ display: 'block' }}>
                    68% Complete
                  </span>
                  <span className="t-caption" style={{ fontSize: '0.75rem' }}>
                    17 of 25 items done
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Live Execution Queue */}
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div
                className="row"
                style={{ justifyContent: 'space-between', marginBottom: '2px' }}
              >
                <span className="t-meta">Today's Priority Actions</span>
                <span className="badge badge--accent">4 Scheduled</span>
              </div>

              {/* Item 1 */}
              <div
                className="card card--muted"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--control-bg)',
                    color: 'var(--control-text)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Check size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: '8px' }}>
                    <span
                      style={{
                        textDecoration: 'line-through',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      5km Morning Zone-2 Run
                    </span>
                    <span className="badge">Habit</span>
                  </div>
                  <div
                    className="row"
                    style={{ gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                  >
                    <Repeat size={12} /> Daily · Morning
                  </div>
                </div>
                <span className="t-meta" style={{ color: 'var(--success)' }}>
                  Logged 07:14
                </span>
              </div>

              {/* Item 2 */}
              <div
                className="card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid var(--border-strong)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Deep Work: Core Architecture Pass</span>
                    <span className="badge">Task</span>
                    <span
                      className="t-meta"
                      style={{ color: '#ef4444', fontWeight: 700 }}
                    >
                      Urgent
                    </span>
                  </div>
                  <p className="card__desc" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                    Finalize state machines and schema isolation boundaries.
                  </p>
                </div>
                <div
                  className="row"
                  style={{ gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                >
                  <Clock size={12} /> Due Today
                </div>
              </div>

              {/* Item 3 */}
              <div
                className="card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid var(--border-strong)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Synthesize Weekly Strategy Notes</span>
                    <span className="badge">Milestone</span>
                    <span className="t-meta" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                      High
                    </span>
                  </div>
                </div>
                <div
                  className="row"
                  style={{ gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                >
                  <Calendar size={12} /> Oct 07
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION: THE PROBLEM */}
      <section id="problem" className="landing__section landing__section--bordered">
        <div className="landing__section-header">
          <span className="landing__eyebrow">THE FRAGMENTATION TRAP</span>
          <h2 className="landing__section-title">
            Why traditional productivity fails high performers.
          </h2>
          <p className="landing__section-desc">
            You don't lack motivation. You are simply exhausted from juggling five disconnected
            apps that never talk to each other.
          </p>
        </div>

        <div className="landing__grid-3">
          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(240 100 100 / 12%)', color: 'var(--danger)' }}
            >
              <Layers size={22} />
            </div>
            <h3 className="landing__card-title">Disconnected To-Do Lists</h3>
            <p className="landing__card-body">
              Tasks float in an unstructured abyss. You check off 14 minor chores while your defining
              quarterly ambitions gather dust. There is no hierarchy connecting what you do at 9:00 AM
              to where you want to be in six months.
            </p>
          </div>

          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(255 185 143 / 22%)', color: '#d97706' }}
            >
              <Zap size={22} />
            </div>
            <h3 className="landing__card-title">Gamified Streak Guilt</h3>
            <p className="landing__card-body">
              Arbitrary streak counters punish you for planned rest days. A missed workout while sick
              breaks your "streak" and causes psychological surrender, instead of respecting
              sustainable recurrence cycles.
            </p>
          </div>

          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(185 167 255 / 20%)', color: '#7c3aed' }}
            >
              <Compass size={22} />
            </div>
            <h3 className="landing__card-title">The Strategic Disconnect</h3>
            <p className="landing__card-body">
              Your goals live in a Notion document, your sprint tasks live in an issue tracker, and
              your habits live on your phone. Without an integrated hierarchy, your energy leaks into
              context-switching chaos.
            </p>
          </div>
        </div>
      </section>

      {/* 4. SECTION: HOW IT WORKS (THE 4-TIER HIERARCHY) */}
      <section id="how-it-works" className="landing__section landing__section--bordered">
        <div className="landing__section-header">
          <span className="landing__eyebrow">THE 4-TIER ARCHITECTURE</span>
          <h2 className="landing__section-title">
            A single, unbroken line from life vision to daily action.
          </h2>
          <p className="landing__section-desc">
            Track.now replaces chaotic scattered notes with a rigorous 4-level execution hierarchy.
          </p>
        </div>

        <div className="landing__tier-row">
          {/* Tier 1 */}
          <div className="landing__tier-card">
            <span className="landing__tier-badge">LEVEL 01</span>
            <div
              className="icon-chip"
              style={{ background: '#c8f169', color: '#141414', alignSelf: 'flex-start' }}
            >
              <Activity size={20} />
            </div>
            <h3 className="landing__card-title">Tracks</h3>
            <p className="landing__card-body">
              <strong>Persistent Life Domains.</strong> Dedicated workspaces for Fitness, Career,
              Wealth, Intellectual Craft, or Custom areas. They isolate cognitive load so your
              professional sprints never drown out your physical health.
            </p>
          </div>

          {/* Tier 2 */}
          <div className="landing__tier-card">
            <span className="landing__tier-badge">LEVEL 02</span>
            <div
              className="icon-chip"
              style={{ background: '#9fd3ff', color: '#141414', alignSelf: 'flex-start' }}
            >
              <FolderKanban size={20} />
            </div>
            <h3 className="landing__card-title">Plans</h3>
            <p className="landing__card-body">
              <strong>Time-Bound Mission Arcs.</strong> Focused execution periods with strict start
              and end boundaries: "Winter Arc", "Q4 Promotion Sprint", "30-Day Metabolic Reset". No
              open-ended never-ending backlogs.
            </p>
          </div>

          {/* Tier 3 */}
          <div className="landing__tier-card">
            <span className="landing__tier-badge">LEVEL 03</span>
            <div
              className="icon-chip"
              style={{ background: '#ffa9c4', color: '#141414', alignSelf: 'flex-start' }}
            >
              <Target size={20} />
            </div>
            <h3 className="landing__card-title">Execution Items</h3>
            <p className="landing__card-body">
              <strong>Concrete Action Units.</strong> Five deliberate types: Habits with recurrence
              schedules (daily, weekly, custom days), Tasks with urgent priority flags, Checklists,
              Projects, and Milestones.
            </p>
          </div>

          {/* Tier 4 */}
          <div className="landing__tier-card">
            <span className="landing__tier-badge">LEVEL 04</span>
            <div
              className="icon-chip"
              style={{ background: '#b9a7ff', color: '#141414', alignSelf: 'flex-start' }}
            >
              <BarChart3 size={20} />
            </div>
            <h3 className="landing__card-title">Truthful Progress</h3>
            <p className="landing__card-body">
              <strong>Pure Mathematical Telemetry.</strong> 0 items = 0%. 1 of 1 = 100%. Verified at
              the database level with unique constraints. No fake XP, no vanity streak algorithms, no
              gamified lies.
            </p>
          </div>
        </div>
      </section>

      {/* 5. SECTION: TRACKS & PLANS IN DEPTH */}
      <section id="tracks-plans" className="landing__section landing__section--bordered">
        <div className="landing__spotlight">
          <div>
            <span className="landing__eyebrow">DOMAINS & MISSION ARCS</span>
            <h2 className="landing__section-title">
              Partition your life so nothing competes unfairly.
            </h2>
            <p className="landing__section-desc" style={{ marginBottom: 'var(--space-4)' }}>
              When career ambitions, fitness routines, and financial goals share a single flat to-do
              list, urgent shallow tasks always cannibalize deep priorities.
            </p>
            <p className="landing__section-desc" style={{ marginBottom: 'var(--space-5)' }}>
              Tracks provide sovereign operating spaces. Each Track contains its own Plans,
              execution items, and mathematical rollups. You can sprint aggressively in your Career
              Track without losing visibility over your Health foundations.
            </p>

            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  Pre-configured catalog templates: Fitness, Finance, Career, Learning, Business
                </span>
              </div>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  Custom life areas with tailored icons and editorial color swatches
                </span>
              </div>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  Template starter item & plan seeding for instantaneous kickoff
                </span>
              </div>
            </div>
          </div>

          {/* Visual Showcase Card */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <span className="t-meta">Life Domains Catalog</span>
              <span className="badge">5 Active Tracks</span>
            </div>

            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div
                className="row"
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-muted)',
                  justifyContent: 'space-between',
                }}
              >
                <div className="row" style={{ gap: '12px' }}>
                  <div
                    className="icon-chip"
                    style={{ background: '#c8f169', color: '#141414' }}
                  >
                    <Activity size={18} />
                  </div>
                  <div>
                    <strong style={{ display: 'block' }}>Fitness Track</strong>
                    <span className="t-caption">Workouts, zone-2 running, sleep hygiene</span>
                  </div>
                </div>
                <span className="badge badge--accent">75% Complete</span>
              </div>

              <div
                className="row"
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-muted)',
                  justifyContent: 'space-between',
                }}
              >
                <div className="row" style={{ gap: '12px' }}>
                  <div
                    className="icon-chip"
                    style={{ background: '#9fd3ff', color: '#141414' }}
                  >
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <strong style={{ display: 'block' }}>Career Track</strong>
                    <span className="t-caption">Quarterly deliverables, promotions, portfolio</span>
                  </div>
                </div>
                <span className="badge">60% Complete</span>
              </div>

              <div
                className="row"
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-muted)',
                  justifyContent: 'space-between',
                }}
              >
                <div className="row" style={{ gap: '12px' }}>
                  <div
                    className="icon-chip"
                    style={{ background: '#ffb98f', color: '#141414' }}
                  >
                    <Wallet size={18} />
                  </div>
                  <div>
                    <strong style={{ display: 'block' }}>Finance Track</strong>
                    <span className="t-caption">Emergency buffer, automated DCA, net-worth</span>
                  </div>
                </div>
                <span className="badge">100% Complete</span>
              </div>

              <div
                className="row"
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-muted)',
                  justifyContent: 'space-between',
                }}
              >
                <div className="row" style={{ gap: '12px' }}>
                  <div
                    className="icon-chip"
                    style={{ background: '#b9a7ff', color: '#141414' }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <strong style={{ display: 'block' }}>Learning & Productivity</strong>
                    <span className="t-caption">Study blocks, deep reading, writing</span>
                  </div>
                </div>
                <span className="badge">40% Complete</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION: TODAY EXECUTION VIEW */}
      <section id="today-view" className="landing__section landing__section--bordered">
        <div className="landing__spotlight landing__spotlight--reverse">
          <div>
            <span className="landing__eyebrow">DAILY OPERATING COCKPIT</span>
            <h2 className="landing__section-title">
              The only screen you open every morning.
            </h2>
            <p className="landing__section-desc" style={{ marginBottom: 'var(--space-4)' }}>
              You don't need to dig through five project boards or decide what to do next. The Today
              View automatically assembles your daily execution pipeline.
            </p>
            <p className="landing__section-desc" style={{ marginBottom: 'var(--space-5)' }}>
              Habits only appear on the exact days they are scheduled. Overdue tasks are elevated
              above the fold. Urgent priorities demand immediate focus. When your scheduled items are
              done, the app greets you with calm closure.
            </p>

            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  Recurrence engine: Daily, weekly, or custom day-of-week recurrence schedules
                </span>
              </div>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  High-contrast Urgent priority badge for mission-critical deliverables
                </span>
              </div>
              <div className="row" style={{ gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
                  One-tap keyboard-accessible status toggle with instant feedback
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Card Showing Today Partition */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h3 className="t-h2" style={{ margin: 0 }}>
                Today's Queue
              </h3>
              <span className="t-caption">Wednesday, Oct 07</span>
            </div>

            {/* Overdue */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <span
                className="t-meta"
                style={{ color: 'var(--danger)', fontWeight: 700, display: 'block', marginBottom: '6px' }}
              >
                Overdue (1)
              </span>
              <div
                className="card"
                style={{
                  padding: '10px 14px',
                  borderLeft: '3px solid var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid var(--danger)',
                  }}
                />
                <span style={{ fontWeight: 600, flex: 1, fontSize: 'var(--text-body)' }}>
                  Submit quarterly tax filing
                </span>
                <span className="badge">Task</span>
              </div>
            </div>

            {/* Due Today */}
            <div>
              <span
                className="t-meta"
                style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}
              >
                Due Today (2)
              </span>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div
                  className="card"
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid var(--border-strong)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>
                        Morning HIIT Routine
                      </span>
                      <span className="badge">Habit</span>
                    </div>
                  </div>
                  <span className="t-meta">Morning</span>
                </div>

                <div
                  className="card"
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid var(--border-strong)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>
                        Deploy V1 Production Release
                      </span>
                      <span className="badge">Milestone</span>
                      <span className="t-meta" style={{ color: '#ef4444', fontWeight: 700 }}>
                        Urgent
                      </span>
                    </div>
                  </div>
                  <span className="t-meta">17:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION: TRUTHFUL TELEMETRY */}
      <section id="telemetry" className="landing__section landing__section--bordered">
        <div className="landing__section-header">
          <span className="landing__eyebrow">MATHEMATICAL RIGOR</span>
          <h2 className="landing__section-title">Telemetry without deception.</h2>
          <p className="landing__section-desc">
            No gamification tricks, no fabricated percentage curves, no arbitrary vanity metrics.
          </p>
        </div>

        <div className="landing__grid-3">
          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(200 241 105 / 20%)', color: '#2f7d4f' }}
            >
              <TrendingUp size={22} />
            </div>
            <h3 className="landing__card-title">Pure Mathematical Rollups</h3>
            <p className="landing__card-body">
              Progress is computed solely from real actions completed: 0 items is strictly 0%. 1 of 1
              is 100%. If you add items mid-sprint, the denominator recalculates truthfully.
            </p>
          </div>

          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(159 211 255 / 20%)', color: '#1e40af' }}
            >
              <Shield size={22} />
            </div>
            <h3 className="landing__card-title">PostgreSQL Unique Constraints</h3>
            <p className="landing__card-body">
              One completion record per item per calendar date is enforced at the PostgreSQL database
              level (<code>uq_track_now_completions_item_date</code>). No phantom double-taps or corrupted logs.
            </p>
          </div>

          <div className="landing__card">
            <div
              className="landing__card-icon"
              style={{ background: 'rgb(185 167 255 / 20%)', color: '#6d28d9' }}
            >
              <LockIcon size={22} />
            </div>
            <h3 className="landing__card-title">Row-Level Security Isolation</h3>
            <p className="landing__card-body">
              Your life metrics, habit completions, and plan data are strictly partitioned by
              authenticated UUID via Supabase RLS. Zero data leakage across workspaces.
            </p>
          </div>
        </div>
      </section>

      {/* 8. SECTION: INTERACTIVE PRODUCT PREVIEW */}
      <section id="preview" className="landing__section landing__section--bordered">
        <div className="landing__section-header">
          <span className="landing__eyebrow">PRODUCT PREVIEW</span>
          <h2 className="landing__section-title">Designed for the editorial mind.</h2>
          <p className="landing__section-desc">
            Try the tactile simplicity of the Track.now interface below. Check off an item to see
            real-time telemetry recalculate.
          </p>
        </div>

        {/* Tab Controls */}
        <div
          className="landing__preview-tabs"
          role="tablist"
          aria-label="Product Preview Navigation"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activePreviewTab === 'today'}
            className={`landing__preview-tab ${
              activePreviewTab === 'today' ? 'landing__preview-tab--active' : ''
            }`}
            onClick={() => setActivePreviewTab('today')}
          >
            Today Queue ({demoCompletedCount}/{demoItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePreviewTab === 'track'}
            className={`landing__preview-tab ${
              activePreviewTab === 'track' ? 'landing__preview-tab--active' : ''
            }`}
            onClick={() => setActivePreviewTab('track')}
          >
            Track Workspace (Fitness)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePreviewTab === 'plan'}
            className={`landing__preview-tab ${
              activePreviewTab === 'plan' ? 'landing__preview-tab--active' : ''
            }`}
            onClick={() => setActivePreviewTab('plan')}
          >
            Plan Arc (Winter Arc)
          </button>
        </div>

        {/* Tab 1: Today Queue */}
        {activePreviewTab === 'today' && (
          <div className="landing__preview-frame" style={{ marginTop: 'var(--space-4)' }}>
            <div className="landing__preview-bar">
              <span className="t-meta">Interactive Demo · Click checkmarks to test</span>
              <span className="badge badge--accent">{demoPercent}% Complete</span>
            </div>
            <div className="landing__preview-content">
              <div
                className="row"
                style={{ justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <h3 className="t-h2" style={{ margin: 0 }}>
                    Today's Priority Pipeline
                  </h3>
                  <p className="t-caption">
                    Derived from your active Plan arcs. Click any circle to toggle status.
                  </p>
                </div>
                <ProgressCircle
                  percent={demoPercent}
                  size={54}
                  color="#c8f169"
                  label="Demo progress"
                />
              </div>

              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {demoItems.map((item) => (
                  <div
                    key={item.id}
                    className={`card ${item.done ? 'card--muted' : ''}`}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => toggleDemoItem(item.id)}
                  >
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      style={{
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        minHeight: '28px',
                        padding: 0,
                        background: item.done ? 'var(--control-bg)' : 'transparent',
                        color: item.done ? 'var(--control-text)' : 'transparent',
                        border: '2px solid',
                        borderColor: item.done ? 'var(--control-bg)' : 'var(--border-strong)',
                        flexShrink: 0,
                      }}
                      aria-label={`Toggle ${item.title}`}
                    >
                      <Check size={14} style={{ opacity: item.done ? 1 : 0 }} />
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            textDecoration: item.done ? 'line-through' : 'none',
                            color: item.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                          }}
                        >
                          {item.title}
                        </span>
                        <span className="badge">{item.type}</span>
                        {item.priority === 'urgent' && (
                          <span className="t-meta" style={{ color: '#ef4444', fontWeight: 700 }}>
                            Urgent
                          </span>
                        )}
                        {item.priority === 'high' && (
                          <span className="t-meta" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                            High
                          </span>
                        )}
                      </div>
                      <div
                        className="row"
                        style={{ gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                      >
                        {item.schedule && (
                          <span>
                            <Repeat size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                            {item.schedule}
                          </span>
                        )}
                        {item.due && <span>Due {item.due}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Track Workspace */}
        {activePreviewTab === 'track' && (
          <div className="landing__preview-frame" style={{ marginTop: 'var(--space-4)' }}>
            <div className="landing__preview-bar">
              <span className="t-meta">Track Overview · Fitness & Physical Health</span>
              <span className="badge">Active Track</span>
            </div>
            <div className="landing__preview-content">
              <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                <div
                  className="icon-chip"
                  style={{ background: '#c8f169', color: '#141414', width: '42px', height: '42px' }}
                >
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="t-h1" style={{ margin: 0 }}>
                    Fitness Track
                  </h3>
                  <p className="t-caption">
                    Routines, zone-2 running, strength training, sleep, and nutrition.
                  </p>
                </div>
              </div>

              <div
                className="hero-progress"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: 'var(--surface-muted)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <ProgressCircle percent={72} size={70} color="#c8f169" label="Fitness track progress" />
                <div>
                  <h4 className="t-h2" style={{ margin: 0 }}>
                    72% Overall Domain Progress
                  </h4>
                  <p className="t-caption" style={{ marginTop: '2px' }}>
                    Derived from 18 completed items across 2 active execution plans.
                  </p>
                </div>
              </div>

              <div className="landing__grid-2">
                <div className="card">
                  <span className="t-meta">Active Plan</span>
                  <h4 className="t-h3" style={{ margin: '4px 0' }}>
                    Winter Arc 2026
                  </h4>
                  <p className="card__desc">60-Day metabolic conditioning sprint.</p>
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-caption)',
                    }}
                  >
                    <span>14 of 18 items done</span>
                    <span className="badge badge--accent">78%</span>
                  </div>
                </div>

                <div className="card">
                  <span className="t-meta">Active Plan</span>
                  <h4 className="t-h3" style={{ margin: '4px 0' }}>
                    Mobility & Sleep Hygiene
                  </h4>
                  <p className="card__desc">Daily evening routine protocol.</p>
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-caption)',
                    }}
                  >
                    <span>4 of 6 items done</span>
                    <span className="badge">66%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Plan Arc */}
        {activePreviewTab === 'plan' && (
          <div className="landing__preview-frame" style={{ marginTop: 'var(--space-4)' }}>
            <div className="landing__preview-bar">
              <span className="t-meta">Plan Workspace · Winter Arc 2026</span>
              <span className="badge">Execution Arc</span>
            </div>
            <div className="landing__preview-content">
              <div>
                <span className="t-meta">Fitness Track · Plan Arc</span>
                <h3 className="t-h1" style={{ marginTop: '2px', marginBottom: '4px' }}>
                  Winter Arc 2026
                </h3>
                <p className="t-caption">
                  Execution arc: Oct 01, 2026 – Dec 31, 2026 · 60-Day Sprint
                </p>
              </div>

              <div className="landing__grid-3">
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <span className="t-meta">Daily Habits (4)</span>
                  <h4 className="t-h2" style={{ margin: '4px 0' }}>
                    100% Scheduled
                  </h4>
                  <p className="card__desc">Zone-2 running, hydration, mobility, 8h sleep.</p>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <span className="t-meta">Sprint Tasks (6)</span>
                  <h4 className="t-h2" style={{ margin: '4px 0' }}>
                    4 Completed
                  </h4>
                  <p className="card__desc">Buy lifting shoes, book blood panel, prep meals.</p>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <span className="t-meta">Target Milestones (2)</span>
                  <h4 className="t-h2" style={{ margin: '4px 0' }}>
                    1 Completed
                  </h4>
                  <p className="card__desc">Complete 10km time trial under 50 minutes.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 9. SECTION: FINAL CTA BANNER */}
      <section className="landing__section">
        <div className="landing__final-banner">
          <span className="landing__eyebrow">RECLAIM YOUR MOMENTUM</span>
          <h2 className="landing__section-title" style={{ maxWidth: '640px', margin: '0 auto var(--space-4)' }}>
            Ready to stop managing tasks and start executing?
          </h2>
          <p
            className="landing__hero-subtitle"
            style={{ maxWidth: '580px', marginBottom: 'var(--space-6)' }}
          >
            Build your persistent life tracks, structure your first execution arc, and replace
            fragmented productivity chaos with calm mathematical progress.
          </p>

          <div className="landing__cta-row" style={{ margin: 0 }}>
            <a href={SIGNUP_URL} className="landing__btn-hero-primary">
              <span>Start Building Your System</span>
              <ArrowRight size={18} />
            </a>
            <a href={LOGIN_URL} className="landing__btn-hero-secondary">
              <span>Sign In to Workspace</span>
            </a>
          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="landing__footer" role="contentinfo">
        <div className="landing__footer-inner">
          <div className="landing__footer-top">
            <div style={{ maxWidth: '320px' }}>
              <div className="landing__brand" style={{ marginBottom: '8px' }}>
                <div className="landing__brand-mark" aria-hidden="true">
                  T
                </div>
                <span>Track.now</span>
              </div>
              <p className="t-caption">
                A personal operating system for execution. Minimal, editorial, mathematically
                truthful.
              </p>
            </div>

            <div className="landing__footer-links">
              <div className="landing__footer-col">
                <span className="landing__footer-heading">Architecture</span>
                <a href="#how-it-works" className="landing__footer-link">
                  The 4 Tiers
                </a>
                <a href="#tracks-plans" className="landing__footer-link">
                  Life Tracks
                </a>
                <a href="#today-view" className="landing__footer-link">
                  Today View
                </a>
                <a href="#telemetry" className="landing__footer-link">
                  Truthful Metrics
                </a>
              </div>

              <div className="landing__footer-col">
                <span className="landing__footer-heading">Platform</span>
                <a href={SIGNUP_URL} className="landing__footer-link">
                  Sign Up
                </a>
                <a href={LOGIN_URL} className="landing__footer-link">
                  Sign In
                </a>
                <a href={`${APP_URL}/dashboard`} className="landing__footer-link">
                  Open Dashboard
                </a>
              </div>

              <div className="landing__footer-col">
                <span className="landing__footer-heading">Theme & Security</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="landing__footer-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                </button>
                <span className="landing__footer-link" style={{ cursor: 'default' }}>
                  Supabase RLS Isolated
                </span>
                <span className="landing__footer-link" style={{ cursor: 'default' }}>
                  Zero Ad Trackers
                </span>
              </div>
            </div>
          </div>

          <div className="landing__footer-bottom">
            <span>© 2026 Track.now. All rights reserved.</span>
            <span>Designed with editorial precision.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

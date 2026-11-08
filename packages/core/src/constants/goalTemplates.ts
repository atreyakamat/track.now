import type { ItemType, NewExecutionItemInput, TemplateType } from '../types/domain'

/**
 * Goal templates power the guided planner. Each one turns a high-level goal into a ready-made
 * track → plan → set of typed items (habits/tasks/milestones) the user can tweak and accept.
 *
 * This is pure, offline data (no network, no AI): predictable and testable. The wizard renders
 * these and calls the same createTrack / createPlan / createExecutionItem services the manual
 * flow uses. A future "describe your goal" AI option can produce the same GoalTemplate shape.
 */

export type GoalCadence = {
  frequency: 'daily' | 'weekly'
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'anytime'
  /** 0=Sun … 6=Sat. Omit for every day. */
  days_of_week?: number[]
}

export interface GoalItemTemplate {
  /** Stable id within the template so the UI can toggle items on/off. */
  key: string
  type: ItemType
  name: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  /** Counter target for habits (e.g. 8 glasses). */
  target_count?: number
  unit?: string
  /** Present for habits; absent for tasks/milestones. */
  cadence?: GoalCadence
}

export interface GoalTemplate {
  key: string
  /** The headline goal, shown as the choice. */
  goal: string
  /** One-line description of the outcome. */
  summary: string
  /** Maps onto the existing track template categories (or 'custom'). */
  category: TemplateType
  icon: string
  color: string
  track: { name: string; description: string }
  plan: { name: string; description: string }
  items: GoalItemTemplate[]
}

const EVERYDAY: number[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS: number[] = [1, 2, 3, 4, 5]

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    key: 'get-fit',
    goal: 'Get fit & build a workout habit',
    summary: 'Move daily, stay hydrated, and keep a repeatable routine.',
    category: 'fitness',
    icon: 'Dumbbell',
    color: '#c8f169',
    track: { name: 'Fitness', description: 'Workouts, movement, hydration and recovery.' },
    plan: { name: 'Get fit', description: 'A simple, sustainable fitness routine.' },
    items: [
      { key: 'move', type: 'habit', name: 'Move for 30 minutes', cadence: { frequency: 'daily', time_of_day: 'morning', days_of_week: EVERYDAY } },
      { key: 'water', type: 'habit', name: 'Drink water', target_count: 8, unit: 'glasses', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'plan-workouts', type: 'task', name: 'Plan this week’s workouts', priority: 'medium' },
      { key: 'month-1', type: 'milestone', name: 'First month of consistency' },
    ],
  },
  {
    key: 'sleep-better',
    goal: 'Sleep better',
    summary: 'Wind down earlier and protect a consistent bedtime.',
    category: 'fitness',
    icon: 'Activity',
    color: '#9eeccd',
    track: { name: 'Sleep', description: 'Better rest through a steadier wind-down routine.' },
    plan: { name: 'Sleep better', description: 'Small evening habits that add up to real rest.' },
    items: [
      { key: 'lights-out', type: 'habit', name: 'Lights out by 11pm', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'no-screens', type: 'habit', name: 'No screens 30 min before bed', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'winddown', type: 'task', name: 'Set up a wind-down routine', priority: 'medium' },
      { key: 'two-weeks', type: 'milestone', name: 'Two weeks of 7+ hours' },
    ],
  },
  {
    key: 'learn-language',
    goal: 'Learn a new language',
    summary: 'Short daily practice plus steady vocabulary review.',
    category: 'learning',
    icon: 'BookOpen',
    color: '#b9a7ff',
    track: { name: 'Language learning', description: 'Daily practice toward real conversations.' },
    plan: { name: 'Learn a language', description: 'Consistent, bite-sized study.' },
    items: [
      { key: 'practice', type: 'habit', name: 'Practice 15 minutes', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'vocab', type: 'habit', name: 'Review vocabulary', target_count: 10, unit: 'words', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'pick-course', type: 'task', name: 'Choose an app or course', priority: 'high' },
      { key: 'conversation', type: 'milestone', name: 'Hold a 5-minute conversation' },
    ],
  },
  {
    key: 'save-money',
    goal: 'Save money & budget',
    summary: 'Track spending daily and automate what you save.',
    category: 'finance',
    icon: 'Wallet',
    color: '#9fd3ff',
    track: { name: 'Money', description: 'Budgeting, saving and mindful spending.' },
    plan: { name: 'Save money', description: 'Build awareness, then automate.' },
    items: [
      { key: 'log-spend', type: 'habit', name: 'Log today’s spending', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'budget', type: 'task', name: 'Set a monthly budget', priority: 'high' },
      { key: 'automate', type: 'task', name: 'Automate a savings transfer', priority: 'medium' },
      { key: 'under-budget', type: 'milestone', name: 'First month under budget' },
    ],
  },
  {
    key: 'read-more',
    goal: 'Read more books',
    summary: 'A nightly reading habit and a list to work through.',
    category: 'learning',
    icon: 'BookOpen',
    color: '#ffb98f',
    track: { name: 'Reading', description: 'A steady reading habit.' },
    plan: { name: 'Read more', description: 'Pages add up fast.' },
    items: [
      { key: 'read-pages', type: 'habit', name: 'Read 20 pages', target_count: 20, unit: 'pages', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'reading-list', type: 'task', name: 'Build a reading list', priority: 'low' },
      { key: 'first-book', type: 'milestone', name: 'Finish your first book' },
    ],
  },
  {
    key: 'side-project',
    goal: 'Launch a side project',
    summary: 'Ship something small with daily focused time.',
    category: 'business',
    icon: 'TrendingUp',
    color: '#ffa9c4',
    track: { name: 'Side project', description: 'From idea to launch, one session at a time.' },
    plan: { name: 'Launch a side project', description: 'Scope small, ship fast.' },
    items: [
      { key: 'build-time', type: 'habit', name: 'Work on the project 45 min', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'mvp', type: 'task', name: 'Define the MVP scope', priority: 'high' },
      { key: 'landing', type: 'task', name: 'Ship a landing page', priority: 'medium' },
      { key: 'launch', type: 'milestone', name: 'Launch day / first user' },
    ],
  },
  {
    key: 'mindfulness',
    goal: 'Reduce stress & be present',
    summary: 'Daily meditation and a short gratitude practice.',
    category: 'learning',
    icon: 'Compass',
    color: '#9eeccd',
    track: { name: 'Mindfulness', description: 'Calm, focus and presence.' },
    plan: { name: 'Be more present', description: 'Small daily moments of calm.' },
    items: [
      { key: 'meditate', type: 'habit', name: 'Meditate 10 minutes', cadence: { frequency: 'daily', time_of_day: 'morning', days_of_week: EVERYDAY } },
      { key: 'gratitude', type: 'habit', name: 'Write one gratitude note', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'screen-free', type: 'task', name: 'Schedule one screen-free hour', priority: 'low' },
      { key: 'two-weeks-calm', type: 'milestone', name: 'Two weeks of daily practice' },
    ],
  },
  {
    key: 'advance-career',
    goal: 'Advance my career',
    summary: 'Learn a skill on weekdays and keep momentum visible.',
    category: 'career',
    icon: 'Briefcase',
    color: '#ffb98f',
    track: { name: 'Career', description: 'Skills, visibility and the next step up.' },
    plan: { name: 'Advance my career', description: 'Compounding weekday effort.' },
    items: [
      { key: 'learn-skill', type: 'habit', name: 'Learn a job skill 30 min', cadence: { frequency: 'weekly', time_of_day: 'anytime', days_of_week: WEEKDAYS } },
      { key: 'resume', type: 'task', name: 'Update resume & LinkedIn', priority: 'high' },
      { key: 'network', type: 'task', name: 'Reach out to one person in your network', priority: 'medium' },
      { key: 'win', type: 'milestone', name: 'Land an interview or a review win' },
    ],
  },
  {
    key: 'student',
    goal: 'Study smarter as a student',
    summary: 'Daily study blocks, weekly review and assignments that never sneak up on you.',
    category: 'learning',
    icon: 'BookOpen',
    color: '#9fd3ff',
    track: { name: 'Studies', description: 'Classes, assignments and exams.' },
    plan: { name: 'This semester', description: 'Steady study beats cramming.' },
    items: [
      { key: 'study-block', type: 'habit', name: 'Focused study block (45 min)', cadence: { frequency: 'weekly', time_of_day: 'afternoon', days_of_week: WEEKDAYS } },
      { key: 'review', type: 'habit', name: 'Review this week’s notes', cadence: { frequency: 'weekly', time_of_day: 'anytime', days_of_week: [0] } },
      { key: 'syllabus', type: 'task', name: 'Put every deadline from the syllabus into Track.now', priority: 'high' },
      { key: 'study-group', type: 'task', name: 'Find or form a study group', priority: 'low' },
      { key: 'first-exam', type: 'milestone', name: 'First exam done with a week of prep' },
    ],
  },
  {
    key: 'freelancer',
    goal: 'Run my freelance business',
    summary: 'Client work, outreach and invoicing on a rhythm that keeps cash flowing.',
    category: 'business',
    icon: 'Briefcase',
    color: '#ffb98f',
    track: { name: 'Freelance', description: 'Clients, pipeline, invoices and skills.' },
    plan: { name: 'Steady pipeline', description: 'Deliver, then fill the next slot.' },
    items: [
      { key: 'deep-work', type: 'habit', name: 'Client deep-work block (2 h)', cadence: { frequency: 'weekly', time_of_day: 'morning', days_of_week: WEEKDAYS } },
      { key: 'outreach', type: 'habit', name: 'Reach out to one prospect', cadence: { frequency: 'weekly', time_of_day: 'afternoon', days_of_week: [2, 4] } },
      { key: 'invoice-day', type: 'habit', name: 'Send invoices and chase late ones', cadence: { frequency: 'weekly', time_of_day: 'afternoon', days_of_week: [5] } },
      { key: 'portfolio', type: 'task', name: 'Update portfolio with the latest project', priority: 'medium' },
      { key: 'retainer', type: 'milestone', name: 'First retainer client' },
    ],
  },
  {
    key: 'new-parent',
    goal: 'Keep my footing as a new parent',
    summary: 'Tiny, forgiving habits for sleep, movement and staying connected.',
    category: 'custom',
    icon: 'Activity',
    color: '#ffa9c4',
    track: { name: 'Family', description: 'The baby, you and your relationship.' },
    plan: { name: 'The first months', description: 'Small wins, no guilt.' },
    items: [
      { key: 'walk', type: 'habit', name: 'A 15-minute walk (with or without the pram)', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'water-meal', type: 'habit', name: 'Drink water and eat one proper meal', cadence: { frequency: 'daily', time_of_day: 'anytime', days_of_week: EVERYDAY } },
      { key: 'partner-check', type: 'habit', name: '10 minutes with your partner, phones away', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'appointments', type: 'task', name: 'Add the next check-up and vaccination dates', priority: 'high' },
      { key: 'help', type: 'task', name: 'Line up one hour of help this week', priority: 'medium' },
    ],
  },
  {
    key: 'exam-prep',
    goal: 'Prepare for an exam',
    summary: 'A countdown with daily practice, weekly mocks and a revision plan.',
    category: 'learning',
    icon: 'BookOpen',
    color: '#b9a7ff',
    track: { name: 'Exam prep', description: 'Everything for the exam.' },
    plan: { name: 'Exam countdown', description: 'Practice daily, test weekly, revise last.' },
    items: [
      { key: 'practice', type: 'habit', name: 'Practice questions (30 min)', cadence: { frequency: 'daily', time_of_day: 'evening', days_of_week: EVERYDAY } },
      { key: 'mock', type: 'habit', name: 'Timed mock test', cadence: { frequency: 'weekly', time_of_day: 'morning', days_of_week: [6] } },
      { key: 'plan-topics', type: 'task', name: 'List every topic and rate your confidence 1–5', priority: 'high' },
      { key: 'weak-topics', type: 'task', name: 'Schedule the three weakest topics first', priority: 'high' },
      { key: 'exam-day', type: 'milestone', name: 'Exam day' },
    ],
  },
  {
    key: 'side-business',
    goal: 'Grow a side business',
    summary: 'Products, marketing and sales in weekly blocks around your day job.',
    category: 'business',
    icon: 'TrendingUp',
    color: '#c8f169',
    track: { name: 'Side business', description: 'Product, marketing, sales, operations.' },
    plan: { name: 'Next 90 days', description: 'One product improvement and one marketing push a week.' },
    items: [
      { key: 'build-block', type: 'habit', name: 'Business block (90 min)', cadence: { frequency: 'weekly', time_of_day: 'evening', days_of_week: [2, 4] } },
      { key: 'post', type: 'habit', name: 'Post about the business', cadence: { frequency: 'weekly', time_of_day: 'anytime', days_of_week: [1, 3, 5] } },
      { key: 'numbers', type: 'habit', name: 'Check orders, replies and numbers', cadence: { frequency: 'weekly', time_of_day: 'evening', days_of_week: [0] } },
      { key: 'offer', type: 'task', name: 'Write the one-line offer and price', priority: 'high' },
      { key: 'ten-customers', type: 'milestone', name: 'Ten paying customers' },
    ],
  },
]

/** The six shown on sign-up, in order. */
export const SIGNUP_TEMPLATE_KEYS = ['student', 'get-fit', 'freelancer', 'new-parent', 'exam-prep', 'side-business'] as const

export function getGoalTemplate(key: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((g) => g.key === key)
}

/** A sensible default clock time (HH:MM) for each time-of-day, used for habit reminders. */
const TIME_OF_DAY_CLOCK: Record<string, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '20:00',
  anytime: '09:00',
}

/** The reminder clock time a wizard habit should fire at, or null for non-habits. */
export function goalItemReminderTime(item: GoalItemTemplate): string | null {
  if (item.type !== 'habit' || !item.cadence) return null
  return TIME_OF_DAY_CLOCK[item.cadence.time_of_day ?? 'anytime'] ?? '09:00'
}

/**
 * Turns a goal item template into the exact payload createExecutionItem expects, given the
 * created plan/track ids. Pure and side-effect free so the wizard and tests share one source.
 */
export function buildGoalItemInput(
  item: GoalItemTemplate,
  ctx: { planId: string; trackId: string },
): NewExecutionItemInput {
  return {
    plan_id: ctx.planId,
    track_id: ctx.trackId,
    type: item.type,
    name: item.name,
    description: item.description ?? null,
    priority: item.priority ?? 'medium',
    due_date: null,
    target_count: item.target_count ?? 1,
    unit: item.unit ?? null,
    schedule:
      item.type === 'habit' && item.cadence
        ? {
            frequency: item.cadence.frequency,
            days_of_week: item.cadence.days_of_week ?? null,
            time_of_day: item.cadence.time_of_day ?? 'anytime',
            reminder_time: goalItemReminderTime(item),
          }
        : null,
  }
}

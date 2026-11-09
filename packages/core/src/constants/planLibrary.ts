/**
 * The Plan library: ready-made plan files (format tracknow.plan.v1) a user can import in one
 * tap and then change freely. Every entry parses with `parsePlanFile`; nothing here is
 * personal data. Dates are relative: `startOffsetDays` from today, `lengthDays` long.
 */
export interface LibraryEntry {
  key: string
  title: string
  tagline: string
  /** What you get, in plain words. */
  blurb: string
  category: 'arc' | 'routine' | 'learning' | 'health' | 'money' | 'home' | 'creative'
  lengthDays: number | null
  /** Tracks → Plans → items, with `{START}` / `{END}` / `{START+n}` date placeholders. */
  file: Record<string, unknown>
}

const arc = (name: string, extra: Record<string, unknown> = {}) => ({ name, kind: 'time_bound', start_date: '{START}', end_date: '{END}', ...extra })
const habit = (name: string, schedule: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: 'habit', name, schedule, ...extra })
const task = (name: string, due: string, extra: Record<string, unknown> = {}) => ({ type: 'task', name, due_date: due, ...extra })
const milestone = (name: string, due: string) => ({ type: 'milestone', name, due_date: due })

export const PLAN_LIBRARY: LibraryEntry[] = [
  {
    key: 'winter-arc-90',
    title: 'Winter Arc · 90 days',
    tagline: 'One focused push across your whole life.',
    blurb: 'Seven areas (Health, Work, Growth, Money, Home, Content, Personal), each with a 90-day Arc, daily routines, weekly habits and phase checkpoints. Week 1 is preparation; the gym starts in week 2.',
    category: 'arc',
    lengthDays: 90,
    file: {
      format: 'tracknow.plan.v1',
      title: 'Winter Arc · 90 days',
      arc: 'Winter Arc',
      tracks: [
        {
          name: 'Health', icon: 'Dumbbell', color: '#22c55e',
          plans: [
            { name: 'Morning & night routines', kind: 'ongoing', arc: null, start_date: '{START}', outcome: 'An early start and a consistent bedtime.', items: [
              habit('Morning routine', { time_of_day: 'morning', reminder_time: '06:00' }, { steps: ['Drink water', 'Brush teeth', 'Stretch for 5 minutes', 'Make the bed', 'Look at Today'] }),
              habit('Night routine', { time_of_day: 'evening', reminder_time: '21:00' }, { steps: ['Tidy the room', 'Prepare tomorrow’s clothes', 'Check tomorrow’s plan', 'Phone away, wind down'] }),
            ] },
            arc('Winter Arc · Fitness', { outcome: 'Four gym days a week plus weekend cardio.', success_criteria: '4 gym sessions in most weeks\nOne cardio session at the weekend', items: [
              task('Prepare gym membership and kit', '{START+6}', { priority: 'high' }),
              milestone('Gym routine starts', '{START+7}'),
              habit('Gym session', { days_of_week: [1, 2, 4, 5], time_of_day: 'morning', reminder_time: '06:30' }, { start_date: '{START+7}', priority: 'high' }),
              habit('Weekend cardio', { days_of_week: [6], time_of_day: 'morning' }, { start_date: '{START+7}' }),
              milestone('Four steady weeks', '{START+35}'),
              milestone('Evaluate fitness and recovery', '{END}'),
            ] }),
          ],
        },
        { name: 'Work', icon: 'Briefcase', color: '#3b82f6', plans: [arc('Winter Arc · Work', { outcome: 'Consistent performance and a record of what I learn.', items: [
          habit('Log today’s work learning (5 min)', { days_of_week: [1, 2, 3, 4, 5], time_of_day: 'afternoon', reminder_time: '17:30' }),
          milestone('Monthly work summary · month 1', '{START+30}'), milestone('Monthly work summary · month 2', '{START+60}'), milestone('Arc work review', '{END}'),
        ] })] },
        { name: 'Growth', icon: 'BookOpen', color: '#8b5cf6', plans: [arc('Winter Arc · Learning', { outcome: 'Finish one practical project.', items: [
          habit('Learning session (45 min)', { days_of_week: [1, 3], time_of_day: 'evening', reminder_time: '19:00' }),
          task('Choose the project', '{START+13}', { priority: 'high' }),
          { type: 'checklist', name: 'Project plan', due_date: '{START+27}', steps: ['Define the result to show', 'Set up the tools', 'First working version', 'Improve', 'Write it up'] },
          milestone('Project working', '{START+60}'), milestone('Project finished or demonstrated', '{END}'),
        ] })] },
        { name: 'Money', icon: 'Wallet', color: '#f59e0b', plans: [arc('Winter Arc · Finances', { outcome: 'Weekly reviews and tracked spending.', items: [
          task('Set up income and expense tracking', '{START+6}'),
          habit('Weekly finance review', { days_of_week: [0], time_of_day: 'evening', reminder_time: '18:00' }),
          milestone('Savings and spending review', '{START+60}'), milestone('Finance Arc review', '{END}'),
        ] })] },
        { name: 'Home', icon: 'Home', color: '#14b8a6', plans: [{ name: 'Household routine', kind: 'ongoing', arc: null, start_date: '{START}', outcome: 'A dependable laundry and room routine.', items: [
          habit('Laundry', { days_of_week: [2, 5], time_of_day: 'evening', reminder_time: '18:30' }),
          habit('Fold, iron, organise', { days_of_week: [3], time_of_day: 'evening' }),
          habit('Weekly shop', { days_of_week: [6], time_of_day: 'afternoon' }),
          habit('Room reset and weekly preparation', { days_of_week: [0], time_of_day: 'afternoon' }),
        ] }] },
        { name: 'Content', icon: 'Video', color: '#ef4444', plans: [arc('Winter Arc · Content', { outcome: 'Publish twice a week.', items: [
          task('Build an idea bank (20 ideas)', '{START+6}'),
          habit('Creation block', { days_of_week: [6], time_of_day: 'afternoon' }),
          habit('Publish a post or video', { times_per_week: 2 }, { start_date: '{START+7}' }),
          milestone('Review growth and consistency', '{END}'),
        ] })] },
        { name: 'Personal', icon: 'Heart', color: '#ec4899', plans: [
          { name: 'Protected personal time', kind: 'ongoing', arc: null, start_date: '{START}', items: [habit('Family, friends or free time', { days_of_week: [6], time_of_day: 'evening' })] },
          arc('Winter Arc · Checkpoints', { outcome: 'Finish knowing what continues, changes or stops.', items: [
            habit('Plan next week', { days_of_week: [0], time_of_day: 'evening', reminder_time: '19:00' }),
            milestone('Week 1 · Prepared', '{START+6}'), milestone('Weeks 2–4 · Routine built', '{START+27}'), milestone('Weeks 5–8 · Momentum built', '{START+55}'), milestone('Weeks 9–13 · Reviewed: continue, change or stop', '{END}'),
          ] }),
        ] },
      ],
    },
  },
  {
    key: 'morning-night',
    title: 'Morning & night routines',
    tagline: 'The two routines that hold a day together.',
    blurb: 'An ongoing Plan with a morning routine, a night routine and a bedtime habit, each with a reminder. Nothing expires.',
    category: 'routine',
    lengthDays: null,
    file: { format: 'tracknow.plan.v1', title: 'Morning & night routines', tracks: [{ name: 'Health', icon: 'Dumbbell', color: '#22c55e', plans: [
      { name: 'Morning & night routines', kind: 'ongoing', start_date: '{START}', outcome: 'A calm start and a consistent bedtime.', items: [
        habit('Morning routine', { time_of_day: 'morning', reminder_time: '06:30' }, { steps: ['Drink water', 'Brush teeth', 'Stretch for 5 minutes', 'Make the bed', 'Look at Today'] }),
        habit('Night routine', { time_of_day: 'evening', reminder_time: '21:00' }, { steps: ['Tidy up', 'Prepare tomorrow’s clothes', 'Check tomorrow’s plan', 'Phone away'] }),
        habit('In bed by 22:30', { time_of_day: 'evening', reminder_time: '22:15' }),
      ] }] }] },
  },
  {
    key: 'marathon-16',
    title: 'First half-marathon · 16 weeks',
    tagline: 'Three runs a week, one long, with rest built in.',
    blurb: 'A 16-week Arc: easy runs on Tuesday and Thursday, a long run on Sunday, strength on Wednesday, and milestones at 5 km, 10 km, 15 km and race day.',
    category: 'health',
    lengthDays: 112,
    file: { format: 'tracknow.plan.v1', title: 'First half-marathon', arc: 'Half-marathon', tracks: [{ name: 'Running', icon: 'Activity', color: '#22c55e', plans: [arc('Half-marathon · 16 weeks', { outcome: 'Finish a half-marathon.', success_criteria: '3 runs in most weeks\nLong run every Sunday', items: [
      habit('Easy run', { days_of_week: [2, 4], time_of_day: 'morning', reminder_time: '06:30' }),
      habit('Long run', { days_of_week: [0], time_of_day: 'morning', reminder_time: '07:00' }),
      habit('Strength and mobility (20 min)', { days_of_week: [3], time_of_day: 'evening' }),
      task('Get fitted for running shoes', '{START+6}', { priority: 'high' }),
      milestone('5 km without stopping', '{START+21}'), milestone('10 km long run', '{START+49}'), milestone('15 km long run', '{START+84}'), milestone('Race day', '{END}'),
    ] })] }] },
  },
  {
    key: 'learn-to-code-90',
    title: 'Learn to code · 90 days',
    tagline: 'Daily practice, weekly projects, one portfolio piece.',
    blurb: 'A 90-day Arc with a daily 45-minute session, a weekly build, and milestones from first program to deployed project.',
    category: 'learning',
    lengthDays: 90,
    file: { format: 'tracknow.plan.v1', title: 'Learn to code', arc: 'Learn to code', tracks: [{ name: 'Growth', icon: 'BookOpen', color: '#8b5cf6', plans: [arc('Learn to code · 90 days', { outcome: 'Build and deploy one small project.', items: [
      habit('Code for 45 minutes', { time_of_day: 'evening', reminder_time: '19:00' }),
      habit('Ship something small', { days_of_week: [6], time_of_day: 'afternoon' }),
      task('Pick a language and a course', '{START+3}', { priority: 'high' }),
      milestone('First program runs', '{START+7}'), milestone('First mini project', '{START+30}'), milestone('Project deployed', '{START+75}'), milestone('Portfolio piece done', '{END}'),
    ] })] }] },
  },
  {
    key: 'declutter-30',
    title: 'Declutter the home · 30 days',
    tagline: 'One space a day, nothing heroic.',
    blurb: 'A 30-day Arc: a daily 15-minute declutter, weekend donation runs and a checklist of rooms.',
    category: 'home',
    lengthDays: 30,
    file: { format: 'tracknow.plan.v1', title: 'Declutter the home', tracks: [{ name: 'Home', icon: 'Home', color: '#14b8a6', plans: [arc('Declutter · 30 days', { outcome: 'Every room has only what we use or love.', items: [
      habit('15-minute declutter', { time_of_day: 'evening', reminder_time: '18:30' }),
      habit('Donation / recycling run', { days_of_week: [6], time_of_day: 'morning' }),
      { type: 'checklist', name: 'Rooms', due_date: '{END}', steps: ['Entrance', 'Kitchen', 'Bedroom', 'Wardrobe', 'Bathroom', 'Living room', 'Desk', 'Storage'] },
      milestone('Half the rooms done', '{START+14}'), milestone('Home decluttered', '{END}'),
    ] })] }] },
  },
  {
    key: 'money-reset-60',
    title: 'Money reset · 60 days',
    tagline: 'See every rupee, dollar or euro, then automate.',
    blurb: 'A 60-day Arc: log spending daily, review weekly, set a budget, automate savings, cancel what you do not use.',
    category: 'money',
    lengthDays: 60,
    file: { format: 'tracknow.plan.v1', title: 'Money reset', tracks: [{ name: 'Money', icon: 'Wallet', color: '#f59e0b', plans: [arc('Money reset · 60 days', { outcome: 'A budget I follow and savings on autopilot.', items: [
      habit('Log today’s spending', { time_of_day: 'evening', reminder_time: '20:30' }),
      habit('Weekly money review', { days_of_week: [0], time_of_day: 'evening' }),
      task('List every subscription and cancel the unused ones', '{START+6}', { priority: 'high' }),
      task('Set the monthly budget', '{START+9}', { priority: 'high' }),
      task('Automate a savings transfer', '{START+20}'),
      milestone('First month under budget', '{START+30}'), milestone('Money reset review', '{END}'),
    ] })] }] },
  },
  {
    key: 'creator-30',
    title: 'Creator sprint · 30 days',
    tagline: 'Post three times a week, learn from the numbers.',
    blurb: 'A 30-day Arc for anyone building an audience: an idea bank, three posts a week, one weekly review of what worked.',
    category: 'creative',
    lengthDays: 30,
    file: { format: 'tracknow.plan.v1', title: 'Creator sprint', tracks: [{ name: 'Content', icon: 'Video', color: '#ef4444', plans: [arc('Creator sprint · 30 days', { outcome: 'A posting rhythm and a sense of what resonates.', items: [
      task('Write 30 ideas', '{START+2}', { priority: 'high' }),
      habit('Publish a post', { times_per_week: 3 }),
      habit('Review the numbers (15 min)', { days_of_week: [0], time_of_day: 'evening' }),
      milestone('12 posts published', '{END}'),
    ] })] }] },
  },
  {
    key: 'exam-8',
    title: 'Exam countdown · 8 weeks',
    tagline: 'Practice daily, mock weekly, revise last.',
    blurb: 'An 8-week Arc with daily practice questions, a Saturday mock, topic ratings and the exam as the final milestone.',
    category: 'learning',
    lengthDays: 56,
    file: { format: 'tracknow.plan.v1', title: 'Exam countdown', tracks: [{ name: 'Studies', icon: 'BookOpen', color: '#9fd3ff', plans: [arc('Exam countdown · 8 weeks', { outcome: 'Walk in prepared.', items: [
      habit('Practice questions (30 min)', { time_of_day: 'evening', reminder_time: '19:30' }),
      habit('Timed mock test', { days_of_week: [6], time_of_day: 'morning' }),
      task('Rate every topic 1–5', '{START+2}', { priority: 'high' }),
      task('Schedule the three weakest topics', '{START+4}', { priority: 'high' }),
      milestone('Halfway mock above target', '{START+28}'), milestone('Exam day', '{END}'),
    ] })] }] },
  },
]

const pad = (n: number) => String(n).padStart(2, '0')
function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** Resolves the date placeholders for a start day; returns a plain object ready for parsePlanFile. */
export function materializeLibraryEntry(entry: LibraryEntry, startDate: string): Record<string, unknown> {
  const end = entry.lengthDays ? shift(startDate, entry.lengthDays - 1) : startDate
  const text = JSON.stringify(entry.file)
    .replace(/\{START\+(\d+)\}/g, (_, n) => shift(startDate, Number(n)))
    .replace(/\{START\}/g, startDate)
    .replace(/\{END\}/g, end)
  return JSON.parse(text) as Record<string, unknown>
}

export function getLibraryEntry(key: string): LibraryEntry | undefined {
  return PLAN_LIBRARY.find((e) => e.key === key)
}

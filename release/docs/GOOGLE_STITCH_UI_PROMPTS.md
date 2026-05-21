# Track.now Unified UI Prompt Pack for Google Stitch

## Purpose
This is the single source prompt document for generating all primary Track.now app screens in Google Stitch.
It is aligned to the product intent from PRD, Product Spec, USER_WORKFLOWS, and DESIGN while enforcing a strict black-and-white minimalist visual language.

Design philosophy summary:
- Clarity over clutter.
- Action over analysis.
- Mission-based progress (21/45/90 days), not endless tracking.
- Identity reinforcement in copy and visual hierarchy.
- Motion as guidance and reward only.

## Non-Negotiable Visual Direction
Use this style on every screen:
- Monochrome only: black, white, and grayscale.
- No colored accents for normal UI states.
- Keep very high whitespace density (if spacing feels enough, increase it by about 20%).
- Surfaces should feel like floating paper cards over a matte black floor.
- Minimalist and premium, never noisy.

Allowed exception:
- Notification unread dot can be red (#FF3B30) for urgency.

## Global Design Tokens
Use these tokens consistently:

- Background: #000000
- Surface 1: #0B0B0B
- Surface 2: #111111
- Border: #1F1F1F
- Divider: #222222
- Text Primary: #FFFFFF
- Text Secondary: #B3B3B3
- Text Tertiary: #808080
- Success (monochrome treatment): use white emphasis, not green
- Warning (monochrome treatment): use contrast and iconography, not amber

Typography:
- Family: Inter Variable, sans-serif fallback
- Title weight: 800
- Subtitle weight: 600
- Body weight: 400 to 500
- Tight title tracking: -0.02em

Spacing scale:
- 8, 12, 16, 24, 32, 40
- Prefer 24+ between primary sections

Radii:
- Cards: 20
- Chips/Pills: 999
- Input/Buttons: 14
- Squircle FAB: 18 to 22

Shadows:
- Heavy soft card shadow: 0 20 50 rgba(0,0,0,0.45)
- Pressed state shadow reduction to imply physical depth

Motion:
- Press interaction scale: 0.97
- List stagger: 100ms per item
- Card enter: fade + translateY(8)
- Reward events only for confetti and completion

## Global App Shell Prompt (Paste Once in Google Stitch)
Use this as the base prompt for all screens:

"Design a mobile-first productivity app shell for Track.now in strict monochrome minimalist style.
Use black background, white text, grayscale surfaces, extreme whitespace, and premium soft shadows.
Build a consistent top identity header and bottom navigation system across all screens.

Header requirements:
- Left: tiny dot-logo
- Center: current page title
- Right: notification bell plus optional red unread dot, and circular profile avatar

Bottom navigation requirements (Navigation Pulse):
- Floating glass-style bar with blur effect and 1px subtle border
- 5 items: Today, Tasks, center Squircle FAB (+), Habits, Planner
- Squircle FAB is rounded-square, not circular
- Keep all controls thumb-friendly with 44px minimum touch targets

Behavior requirements:
- Every tap scales to 0.97 then springs back
- Stagger list animations at 0.1s
- Preserve calm and quiet tone in all labels
- Keep copy action-first, short, and reassuring

Product logic requirements:
- Emphasize mission framing: Day X/21, Day X/45, Day X/90
- Include identity reinforcement language where relevant
- Show progress as countdown to mission completion, not infinite streak pressure
"

## Screen 1 Prompt: Today Page (Action Hub)
Paste this with the global prompt:

"Create the Today page as a calm action hub with zero anxiety.

Layout:
- Hero section with oversized circular mission progress ring near top center
- Large percentage and mission label inside ring (example: 67% complete, Day 14/21)
- One prioritized card labeled Next Mission with breathing glow animation
- Habit list for today only, clean and scrollable

Feature details:
- Hero ring should visually intensify as completion rises
- Next Mission card text: Do this one now
- Completion action on each item with fast tactile feedback
- At 100%, trigger celebration layer: slight dim backdrop + high-density monochrome confetti burst

Copy tone:
- Calm, direct, supportive
- Include identity reinforcement line such as:
  You are 40% of the way to becoming a Disciplined Learner

States:
- Empty state: No habits scheduled today
- Complete state: Mission complete with celebratory overlay
"

## Screen 2 Prompt: Tasks Page (Brain Dump)
Paste this with the global prompt:

"Create a utility-first Tasks page optimized for speed capture.

Layout:
- Top quick-capture input row with add action
- Prominent microphone button for NLP voice capture
- Tasks grouped into High, Medium, Low sections
- Each section separated by label and minimal divider

Feature details:
- Mic button animates with subtle ripple while recording
- Parse natural language tasks (example: Buy milk at 5pm) into title + time metadata
- Priority groups should be visually separated with monochrome left border strength (thick for High, medium for Medium, thin for Low)
- Swipe right to complete interaction with strike-through transition and item moving to completed area at bottom

Micro-interaction:
- Completion uses smooth slash animation and reordering

States:
- Empty state with quick examples
- Recording state for voice capture
"

## Screen 3 Prompt: Habits Page (Mission Command)
Paste this with the global prompt:

"Create a strategic Habits page focused on long-term mission pride.

Layout:
- Header summary row: Active Missions, Completed Missions, Momentum
- Habit cards in vertical stack with strong whitespace

Feature details on each habit card:
- Habit name + optional emoji/icon
- Identity badge chip (example: Athlete, Reader, Learner)
- Horizontal mission progress bar and text Day 14/21
- Schedule and reminder time metadata
- Grace control: Skip for Today or Pause Today without breaking momentum

Behavior:
- Habit card press has physical depth effect
- Progress updates animate smoothly

Copy:
- Avoid guilt language
- Use paused momentum phrasing instead of broken streak phrasing
"

## Screen 4 Prompt: Planner Page (Horizon View)
Paste this with the global prompt:

"Create a future-planning Planner page that feels organized and calm.

Layout:
- Top horizontal weekly pill scroller (Mon to Sun with date)
- Stress Meter card beneath date strip
- Daily schedule list grouped by morning, afternoon, evening

Feature details:
- Tapping a day filters all tasks and habits below
- Stress Meter shows load level using monochrome fill and warning copy when overloaded
- Warning example: This day looks heavy

Behavior:
- Day selection should animate smoothly
- Keep information density moderate and highly legible

States:
- Balanced day state
- Heavy day warning state
"

## Screen 5 Prompt: Analytics Page (Satisfaction View)
Paste this with the global prompt:

"Create an analytics page that is scientific, clean, and satisfying without clutter.

Layout:
- Top summary chips: Completion Rate, Momentum, Mission Success
- 90-day heatmap block (GitHub-style grid)
- Momentum line graph showing 7-day rolling average
- Optional compact breakdown cards below charts

Feature details:
- Heatmap uses monochrome intensity levels from dark gray to white (no green)
- Line graph uses white line with subtle area fill in gray
- Trend emphasis over streak obsession

Copy:
- Labels should reinforce consistency and trend direction
- Example: Momentum is trending upward

States:
- No data state with onboarding cue
- Data-rich state with full chart stack
"

## Screen 6 Prompt: Profile Page (Digital Home)
Paste this with the global prompt:

"Create a premium personal Profile page with identity and settings.

Layout:
- Top identity card with avatar, name, and role statement
- Identity stats section (example: Level 5 Athlete, Level 2 Learner)
- Trophy shelf section for completed 21/45/90 day missions
- Settings suite section at bottom

Feature details:
- Trophy shelf uses clean icon tiles in monochrome style
- Settings list includes:
  Dark Mode toggle
  Notification times
  Export data (CSV)
  Privacy controls

Copy:
- Reflect who user is becoming
- Keep tone encouraging but not loud
"

## Screen 7 Prompt: Social Activity Map (Community Pulse)
Paste this with the global prompt:

"Create a social accountability map screen that feels connected but quiet.

Layout:
- Top stats row: Active Friends, Live Completions, Privacy Mode
- Main area: stylized grid/map with pulsing friend activity dots
- Bottom sheet or side panel for selected friend actions

Feature details:
- Tap a friend dot to open quick nudge actions: fire or clap
- Nudge actions should be minimal and one-tap
- Include Privacy Mode toggle labeled Go Ghost to hide user activity

Behavior:
- Dot pulses should be subtle and non-distracting
- Keep silent accountability vibe, avoid gamified noise

States:
- Private mode on
- Live mode with recent activity
"

## Optional Route Mapping (For Stitch Project Naming)
Use these names while generating screens:
- Today: /today
- Tasks: /tasks
- Habits: /habits
- Planner: /planning
- Analytics: /analytics
- Profile: /profile
- Social Activity Map: /friends (or /social)

## Output Constraints for Google Stitch
Add this at the end of each Stitch request:

"Generate high-fidelity mobile UI mockups with reusable components.
Keep all screens visually consistent with the same black-and-white design system.
No colorful accents except optional red notification dot.
Use Inter Variable typography.
Preserve mission-based framing and identity reinforcement copy.
Return componentized layout suitable for handoff to engineering."

# 🔄 USER WORKFLOWS & TIMELINES

This document outlines the specific workflows for different user states and the "Habit Builder" onboarding experience.

---

## 🏗️ 1. THE HABIT BUILDER (ONBOARDING FLOW)
The "Builder" is the first interaction a new user has. It’s designed to be conversational and guiding.

### Step 1: Identity & Personalization
* **Question:** "What should we call you?"
* **Action:** Input Name.
* **UI:** Big, friendly text. "Hi [Name], let's build your ideal day."

### Step 2: Goal Discovery
* **Question:** "What's your primary focus right now?"
* **Options:** Health, Mindset, Career, Learning, Creativity.
* **UI:** Card-based selection with icons.

### Step 3: Habit Selection (The "Starter" Pack)
* **Question:** "Which of these small wins do you want to start with?"
* **Action:** User selects 1-3 habits from a curated list based on Step 2.
* **Examples:** "Drink 2L water", "Read 10 mins", "Meditate for 5 mins".

### Step 4: Refinement (Preferences)
* **Question:** "When do you want to do these?"
* **Action:** Set reminder times for each selected habit.
* **UI:** Simple time picker cards.

### Step 5: Commitment
* **Question:** "How long is your first mission?"
* **Options:** 21 days (Easy), 45 days (Medium), 90 days (Hard).
* **UI:** Progress bar showing the "Mission" length.

---

## 🕒 2. USER TIMELINES & STATES

### A. The "Alpha" New User (Day 1-7)
* **Goal:** Establish the habit of opening the app.
* **Workflow:**
    1. **Morning:** Push notification "Your mission starts now! 🚀"
    2. **During Day:** Gentle reminders 20 mins before habit time.
    3. **Evening:** "Day [X] Complete! You're [X]% closer to becoming an [Identity]."
* **Special Logic:** If a user misses Day 1 or 2, trigger a "Grace Period" message: "Starting is the hardest part. Let's try again tomorrow, no pressure."

### B. The "Consistent" Returning User (Day 8-30)
* **Goal:** Maintain momentum and introduce social/advanced features.
* **Workflow:**
    1. **Dashboard:** Shows "Momentum Score" prominently.
    2. **Intervention:** If momentum drops below 50%, suggest "Scaling back" (e.g., "Maybe 10 mins is too much? Try 5 mins today?").
    3. **Social:** Suggest joining a Group or adding a Friend once a 7-day streak is hit.

### C. The "Veteran" User (Day 30+)
* **Goal:** Mastery and expansion.
* **Workflow:**
    1. **Analytics:** Deep dive into Heatmaps and Identity progress.
    2. **Expansion:** Prompt to add a new category or increase difficulty.
    3. **Leadership:** Ability to create Groups and invite others.

---

## 🔄 3. RETENTION WORKFLOWS

### 1. The "Coming Back" User (After 3+ days inactive)
* **Screen:** Welcome back screen. "We missed you! Your mission is still waiting. Start fresh today?"
* **Action:** Automatically apply a "Grace" to the missed days so the streak doesn't feel "broken," just "paused."

### 2. The "Daily Routine" User
* **Screen:** Direct to `/today`.
* **Action:** One-tap completion. Instant haptic feedback and confetti for the last habit of the day.

---

## 📱 4. WHATSAPP WORKFLOW (THE "SILENT ASSISTANT")
* **8:00 AM:** "Good morning [Name]! You have 3 habits planned for today. Ready to crush it?"
* **Habit Time:** "Time for [Habit Name]! Reply 'DONE' to mark it complete."
* **End of Day:** "3/3 Habits done! 🔥 You're on a 5-day streak."

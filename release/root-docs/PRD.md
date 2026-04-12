# 📘 PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name: Track.now

---

# 🧠 1. PRODUCT OVERVIEW

Track.now is a habit-building system designed to help users take small daily actions that lead to long-term personal growth. Unlike traditional habit trackers, this product focuses on clarity, simplicity, and emotional engagement. The goal is to make users feel guided rather than pressured.

At its core, Track.now answers one simple question every time a user opens the app:
👉 “What should I do right now?”

The app avoids clutter, avoids overwhelming dashboards, and instead focuses on actionable steps, visual feedback, and gentle accountability.

This product is designed for:

* Students
* Young professionals
* Families
* Beginners in self-improvement

The reading level should be understandable by someone aged 10–11, while the system design should still be robust enough for developers and builders.

---

# 🎯 2. PRODUCT GOALS

### Primary Goals:

* Help users build consistent habits
* Reduce friction in tracking habits
* Provide visual motivation
* Encourage long-term behavior change

### Secondary Goals:

* Enable social accountability
* Introduce light gamification
* Provide insights without overwhelming data

---

# 👤 3. USER TYPES

### 1. Solo User

A person who wants to track habits alone.

### 2. Social User

A person who wants to track habits with friends.

### 3. Family User

A group (parent + children) tracking habits together.

---

# 🧭 4. USER FLOW (STEP-BY-STEP)

### First Time Experience:

1. User opens app
2. Sees clean landing screen
3. Clicks "Get Started"
4. Signs up (email/password)
5. Goes to onboarding

### Onboarding:

* Select goals (Health, Study, Fitness, etc.)
* Add 1–3 habits
* Choose category + time

### Daily Use:

1. Open app
2. See "Today" screen
3. Tap "Complete"
4. Get visual feedback (progress/streak)

---

# 🧱 5. CORE FEATURE SYSTEM

---

## 🎨 5.1 CATEGORY SYSTEM

Users can create categories to organize their habits.

Each category includes:

* Name (e.g., Health, Study)
* Color (choose from 8 predefined colors)

### Example:

Health → Green
Study → Blue

### Why this matters:

It helps users feel like they are improving different areas of life, not just ticking boxes.

---

## 🔁 5.2 HABIT SYSTEM

Each habit is treated like a “skill-building action.”

### Habit Fields:

* Name (e.g., Drink Water)
* Emoji/Icon
* Category
* Days (Mon–Sun)
* Time (one or multiple)
* Duration (21 / 45 / 90 days)

### Example:

“Read 10 pages”
Category: Learning
Time: 8:00 PM
Duration: 21 days

---

## ⏱️ 5.3 MULTI-TIME REMINDERS

Users can set multiple reminder times for one habit.

### Example:

* 8:00 AM
* 8:00 PM

Each reminder triggers:

1. Pre-alert (20 mins before)
2. Exact-time alert

---

## 🔔 5.4 SMART NOTIFICATION SYSTEM

### Notification Flow:

* 20 mins before → “Upcoming habit”
* Exact time → Full-screen prompt

### Full-Screen Prompt:

User sees:

* “Have you completed this habit?”

Options:

* Yes
* Skip
* Remind later

This ensures interaction, not passive reminders.

---

## 📅 5.5 TODAY VIEW (MAIN SCREEN)

This is the most important screen.

It shows:

* Only today’s habits
* Progress bar
* Completion status

### Behavior:

* Tap → mark complete
* Immediate visual feedback

---

## 🔥 5.6 STREAK + DURATION SYSTEM

Instead of only streaks, Track.now uses duration-based tracking.

### Types:

* 21 days
* 45 days
* 90 days

### Display:

Day 7 / 21

This creates a “mission feeling” instead of endless tracking.

---

## 📊 5.7 ANALYTICS SYSTEM

Simple and visual.

Includes:

* Donut chart → daily completion
* Pie chart → category performance

### Example:

Health: 40%
Study: 30%

---

## 🟩 5.8 HEATMAP SYSTEM

Inspired by GitHub.

Shows:

* Completed days (green)
* Missed days (gray/red)

Users can scroll through months.

This builds long-term visual satisfaction.

---

## 🧠 5.9 MOMENTUM SCORE

Instead of only streaks:

Momentum = last 7 days success %

Example:
5/7 days → 71%

This prevents discouragement.

---

## 🧬 5.10 IDENTITY SYSTEM

Each category links to an identity.

Example:

* Study → Learner
* Fitness → Athlete

### UI Example:

“You are becoming a Disciplined Learner (32%)”

This creates emotional engagement.

---

## ⚖️ 5.11 GRACE SYSTEM

Users are allowed:

* 1 skip per week (optional)

Instead of:
“Streak broken”

Show:
“You paused your streak”

This prevents quitting.

---

## 🎯 5.12 HABIT DIFFICULTY

User selects:

* Easy
* Medium
* Hard

### Benefit:

Gives sense of achievement.

---

# 👥 6. SOCIAL FEATURES

---

## 🤝 FRIEND SYSTEM

* Add friends by username
* Accept/reject requests

Users can:

* View streaks
* See activity (optional)

---

## 👨‍👩‍👧 FAMILY SYSTEM

* One admin creates family
* Invites members

Features:

* Shared dashboard
* Progress overview

---

## 👥 GROUP SYSTEM

* Create group
* Add shared habits
* Leaderboard

---

# 💰 7. PRICING MODEL

---

### FREE:

* Max 5 habits
* Basic tracking

### PRO:

* Unlimited habits
* Analytics
* WhatsApp reminders

### FAMILY:

* Multiple users
* Shared tracking

---

# 💬 8. WHATSAPP INTEGRATION

Users receive:

* Habit reminders
* Daily summaries

### Example:

“Hey! Time to read 10 pages 📚”

---

# 🌐 9. BROWSER EXTENSION

Shows:

* Today’s habits
* Quick toggle

Minimal UI.

---

# 🎨 10. UI/UX DESIGN SYSTEM

---

### Style:

* Minimal (Notion-like)
* Clean spacing
* Rounded corners

### Colors:

Light:

* Background: soft white

Dark:

* Background: deep gray

### Components:

* Habit Card
* Progress Ring
* Add Button

---

# ⚙️ 11. TECHNICAL ARCHITECTURE

---

### Frontend:

* Quasar (Vue 3)
* Pinia

### Backend:

* Firebase

### Notifications:

* Capacitor
* WhatsApp API

---

# 🚀 12. BUILD PHASES

---

### Phase 1:

* Habits
* Today screen
* Notifications

### Phase 2:

* Analytics
* Heatmap
* Categories

### Phase 3:

* Social
* WhatsApp
* Payments

---

# ⚠️ 13. PRODUCT PRINCIPLES

---

* Keep it simple
* Avoid clutter
* Focus on action
* Make it feel calm

---

# 🧠 FINAL NOTE

Track.now is not just a habit tracker.

It is:
👉 A system that helps users become better versions of themselves, one small action at a time.

Every feature should support that goal.

END OF PRD

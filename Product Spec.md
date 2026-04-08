# Track.now — Complete Product Specification Document

---

## 1. INTRODUCTION

Track.now is a modern habit-building ecosystem designed to help users take consistent daily actions and gradually improve their lives. The product focuses on simplicity, clarity, and emotional engagement rather than overwhelming users with complex dashboards or excessive data.

The central philosophy of Track.now is: “Do what matters now.”

This means every design decision, feature, and interaction should guide the user toward immediate action instead of passive observation.

---

## 2. PRODUCT OBJECTIVE

The primary objective of Track.now is to:

* Help users build habits consistently
* Reduce friction in daily tracking
* Provide meaningful visual feedback
* Encourage long-term behavior change

Secondary objectives include:

* Enabling social accountability
* Introducing controlled gamification
* Offering optional insights without clutter

---

## 3. TARGET USERS

Track.now is designed for a wide range of users including:

1. Students who want to build study habits
2. Young professionals improving productivity
3. Individuals starting self-improvement journeys
4. Families encouraging shared growth

The interface should be simple enough for younger users (around age 10–11) to understand, while still being powerful for advanced users.

---

## 4. PLATFORM ARCHITECTURE

Track.now consists of the following platforms:

1. Web Application (Primary platform)
2. Android Application (via Capacitor)
3. Browser Extension (Chrome)
4. WhatsApp Integration (Reminders + Summaries)
5. Landing Website (Marketing + Conversion)

All platforms must feel unified and consistent.

---

## 5. APPLICATION ROUTES (VERY IMPORTANT)

### AUTH ROUTES

/login
Handles user login via email and password. Includes validation, error handling, and password reset option.

/signup
Allows new users to create an account. Should be simple and fast.

/onboarding
Guides the user through initial setup. Includes selecting goals, creating first habits, and understanding the app.

---

### CORE APPLICATION ROUTES

/dashboard
High-level overview. Should not be overloaded. Can show summary stats.

/today (PRIMARY SCREEN)
This is the most important route. Displays only today’s habits. Users interact here daily.

/habits
Shows all habits created by the user. Allows editing and deleting.

/habit/:id
Detailed view of a specific habit. Shows history, streak, and performance.

/add
Interface to create a new habit.

/calendar
Displays heatmap of habit completion over time.

/analytics
Shows charts like donut and pie for performance.

---

### SOCIAL ROUTES

/friends
Manage friend requests and view connections.

/user/:username
Public or semi-private profile view.

/groups
List of all groups user is part of.

/group/:id
Detailed group page with shared habits and leaderboard.

/family
Family management dashboard.

/family/:id
Detailed family tracking interface.

---

### SYSTEM ROUTES

/notifications
Manage notification preferences.

/settings
User preferences including theme, privacy, and account settings.

/pricing
Displays subscription plans.

---

### LANDING ROUTES

/
Homepage with hero and CTA.

/features
Explains features clearly.

/pricing
Public pricing page.

/about
About product and vision.

/contact
Support or contact form.

---

## 6. CATEGORY SYSTEM

Users can create categories to group habits. Each category has:

* Name
* Color (from predefined palette of 8 colors)

Categories help users mentally organize their habits into life areas such as Health, Study, Fitness, and Mindfulness.

---

## 7. HABIT SYSTEM

Each habit includes:

* Name
* Emoji/Icon
* Category
* Days (Mon–Sun selection)
* Time (multiple reminders allowed)
* Duration (21 / 45 / 90 days)

Habits are treated as “skill-building actions” rather than simple tasks.

---

## 8. REMINDER SYSTEM

Each habit can have multiple reminders per day.

Example:

* 8:00 AM
* 8:00 PM

Notification flow:

1. Pre-reminder (20 minutes before)
2. Exact-time reminder

Full-screen interaction must appear at exact time with options:

* Yes (completed)
* Skip
* Remind later

---

## 9. TODAY VIEW

This is the core experience.

Displays:

* Only today’s habits
* Progress bar
* Completion actions

Interaction must be fast and satisfying.

---

## 10. STREAK & DURATION SYSTEM

Habits are tracked using fixed durations:

* 21 days
* 45 days
* 90 days

Users see progress like:
Day 7 / 21

This creates a mission-like experience.

---

## 11. ANALYTICS SYSTEM

Includes:

* Donut chart for completion
* Pie chart for category breakdown

Must remain minimal and not overwhelming.

---

## 12. HEATMAP SYSTEM

Displays historical activity in grid format.

* Green = completed
* Gray/Red = missed

Users can scroll through months.

---

## 13. MOMENTUM SYSTEM

Instead of relying only on streaks:

Momentum Score = last 7 days completion percentage

This prevents discouragement.

---

## 14. IDENTITY SYSTEM

Each category maps to identity.

Example:
Study → Learner
Fitness → Athlete

UI shows progress toward identity.

---

## 15. GRACE SYSTEM

Allows limited skips without breaking streak.

Message tone should be positive:
“Your streak is paused” instead of “broken”.

---

## 16. HABIT DIFFICULTY

Each habit can be:

* Easy
* Medium
* Hard

Used to give better feedback.

---

## 17. SOCIAL FEATURES

### Friends

* Add users
* View activity (optional)

### Groups

* Shared habits
* Leaderboard

### Family

* Multi-user dashboard
* Admin control

---

## 18. WHATSAPP INTEGRATION

Used for:

* Reminders
* Daily summaries

Messages should feel human and encouraging.

---

## 19. BROWSER EXTENSION

Provides:

* Quick view of today’s habits
* Fast completion toggle

Minimal UI only.

---

## 20. UI/UX DESIGN PRINCIPLES

* Minimal and clean
* Soft shadows
* Rounded corners
* Neutral colors
* Smooth animations

Dark mode must be supported.

---

## 21. TECH STACK

Frontend:

* Quasar (Vue 3)
* Pinia

Backend:

* Firebase

Notifications:

* Capacitor
* WhatsApp API

Payments:

* Stripe

---

## 22. BUILD PHASES

Phase 1:

* Core habits
* Today screen
* Notifications

Phase 2:

* Analytics
* Heatmap
* Categories

Phase 3:

* Social features
* WhatsApp
* Payments

---

## 23. FINAL PRODUCT PRINCIPLE

Track.now is not just a habit tracker.

It is a system designed to help users become better versions of themselves through consistent daily actions.

Every feature must support this goal.

---

END OF DOCUMENT

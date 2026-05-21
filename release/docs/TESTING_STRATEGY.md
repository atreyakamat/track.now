# 🧪 Track.now PWA Quality & Testing Strategy

To ensure Track.now feels like a "Professional Grade" product, we must move from "It works on my machine" to "Verified Excellence."

## 1. The Testing Pyramid
Our strategy focuses on three layers:
- **Manual QA:** Human-centric testing for "feel," haptics, and animations.
- **Unit Testing (Logic):** Verifying the habit logic, mission progress, and NLP parsing.
- **PWA/E2E Testing:** Verifying the "Install" experience and Offline capabilities.

---

## 2. Priority Test Areas

### A. The "Offline-First" Experience (The PWA Core)
*Crucial for a habit tracker. If I’m in a tunnel, I still need to mark my habit.*
- **Sync Logic:** Test marking a habit offline -> coming online -> verifying Firestore update.
- **Background Update:** Verifying the app prompts for a "New Version Available" when the Service Worker updates.

### B. Habit & Mission Logic
*If the math is wrong, the user loses trust.*
- **Mission Completion:** Test that reaching Day 21/45/90 correctly triggers the "Mission Complete" state.
- **Multi-session Habits:** Verify that a twice-daily habit only marks the day complete on the *second* check-in.
- **Grace Logic:** Verify that a "Skip" doesn't reset the momentum score incorrectly.

### C. Authentication & State
- **Cold Boot:** Test app behavior when starting without internet.
- **Session Persistence:** Verify that the user stays logged in after closing the PWA and reopening it.

---

## 3. Recommended Tools
| Tool | Purpose | Status |
| :--- | :--- | :--- |
| **Vitest** | Fast unit testing for Vue stores and Utils. | 🏗️ To be added |
| **Lighthouse** | Performance, Accessibility, and PWA Audits. | ✅ Available in Chrome |
| **Firebase Emulator** | Local testing of Firestore rules without hitting production. | 🏗️ To be added |

---

## 4. Automation Roadmap
1. **Phase 1:** Implement `MANUAL_TEST_CASES.md` (Human testing).
2. **Phase 2:** Add Vitest to test `habitModel.js` and `nlpParser.js`.
3. **Phase 3:** Add Cypress for "Mark Habit as Done" flow.

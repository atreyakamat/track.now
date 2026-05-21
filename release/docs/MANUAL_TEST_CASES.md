# 📝 Manual Test Cases: Track.now PWA

Use this document to manually verify the "Feel" and "Reliability" of the app on your phone.

## 🟢 1. PWA & Installation
| Test ID | Action | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| PWA-01 | Open `app.tracknow.stixnvibes.com` on iPhone/Android. | Browser should show "Add to Home Screen" or install prompt. | |
| PWA-02 | Install app and open it from the home screen. | No browser address bar. App should open in full-screen "Standalone" mode. | |
| PWA-03 | Open app -> Turn on Airplane Mode -> Refresh. | App should still load and show the UI (Offline Support). | |

## 🟢 2. The "Today" Hub (Haptics & Celebrations)
| Test ID | Action | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| UI-01 | Tap the "Check" button on a pending habit. | Card should scale down slightly, checkmark should animate, and a toast notification should appear. | |
| UI-02 | Complete all habits for today. | Confetti cannon should fire from the bottom of the screen. 🎊 | |
| UI-03 | Tap "Undo" on a completed habit. | Habit should move back to the "Pending" list smoothly. | |

## 🟢 3. Mission Logic
| Test ID | Action | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| LOG-01 | Create a habit with "2 sessions per day" (e.g., Morning/Night). | Today view should show "0/2 done". | |
| LOG-02 | Mark 1 session done. | Card should update to "1/2 done" but stay in the "Pending" list. | |
| LOG-03 | Mark 2nd session done. | Card should move to "Completed" list. | |

## 🟢 4. Social Activity Map
| Test ID | Action | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| SOC-01 | Open Profile -> Toggle "Public Profile" to OFF. | Verify (later) that your activity dot disappears from the global map. | |
| SOC-02 | View a friend's profile from the Friends list. | Their trophy shelf and mission progress should load correctly. | |

## 🟢 5. Persistence & Sync
| Test ID | Action | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| SYN-01 | Mark habit done on Phone -> Open app on Desktop. | Desktop should update automatically to show the habit is done (Firestore Sync). | |
| SYN-02 | Log out -> Log in with a different email. | No data from the previous user should be visible. | |

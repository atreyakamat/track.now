# Track.now Launch Checklist

## Required credentials

- Firebase web config values in `app/.env`
- Firebase Authentication enabled for email/password
- Firestore security rules reviewed for `users`, `habits`, `completions`, `friendships`, and `groups`
- Real production domain for the landing page and app

## Fast local launch (no backend)

- If Firebase env values are missing, app now auto-runs in local demo mode
- Data persists in browser local storage
- Useful for product walkthroughs, UI QA, and device testing before backend setup

## Recommended next integrations

- Stripe checkout + webhook backend for real billing
- WhatsApp provider credentials for live reminder delivery
- Capacitor notification setup for Android exact-time reminders
- Production Firebase project for extension/app sync

## Before publishing

- Build the Quasar app: `npm run build` inside `app`
- Load the extension from `extension/` in Chrome
- Add production URLs to landing and extension links if they differ from `tracknow.app`
- Optional release pack: `powershell -ExecutionPolicy Bypass -File scripts/prepare-release.ps1`
- Full ship pipeline: `powershell -ExecutionPolicy Bypass -File scripts/ship-all.ps1`

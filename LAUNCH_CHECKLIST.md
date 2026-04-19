# Track.now Launch Checklist

## Required credentials

- Firebase web config values in:
	- `app/.env.development`
	- `app/.env.production`
- Firebase Authentication enabled for email/password
- Firestore security rules reviewed and deployed for `users`, `tasks`, `habits`, `completions`, `friendships`, and `groups`
- Real production domain for the landing page and app

## Fast local launch (no backend)

- If Firebase env values are missing, app now auto-runs in local demo mode
- Data persists in browser local storage
- Useful for product walkthroughs, UI QA, and device testing before backend setup

## Production bridge (required before real launch)

- Copy `app/.env.development.example` to `app/.env.development` and set dedicated dev Firebase keys
- Copy `app/.env.production.example` to `app/.env.production` and set production Firebase keys
- Keep `VITE_USE_DEMO_MODE=false` in both files
- Keep `VITE_REQUIRE_FIREBASE_IN_PROD=true` in production to prevent accidental demo launches
- Copy `.firebaserc.example` to `.firebaserc` and set Firebase project IDs
- Install Firebase CLI optionally: `npm install -g firebase-tools`
- Login once (or via `npx firebase-tools login`): `firebase login`

## Recommended next integrations

- Stripe checkout + webhook backend for real billing
- WhatsApp provider credentials for live reminder delivery
- Capacitor notification setup for Android exact-time reminders
- Production Firebase project for extension/app sync

## Before publishing

- Build the installable PWA app: `npm run build:pwa` inside `app`
- Deploy rules + hosting: `powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -ProjectId <your-production-project-id>`
- Verify install assets exist in build output:
	- `app/dist/pwa/manifest.json`
	- `app/dist/pwa/sw.js`
	- `app/dist/pwa/icons/icon-maskable-192x192.png`
	- `app/dist/pwa/icons/icon-maskable-512x512.png`
- Load the extension from `extension/` in Chrome
- Add production URLs to landing and extension links if they differ from `tracknow.app`
- Optional release pack: `powershell -ExecutionPolicy Bypass -File scripts/prepare-release.ps1`
- Full ship pipeline: `powershell -ExecutionPolicy Bypass -File scripts/ship-all.ps1`

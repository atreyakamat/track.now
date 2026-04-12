# Track.now

Track.now is a mission-based habit product with:
- Web app (Quasar + Vue 3)
- Browser extension
- Landing page
- Product/business documentation
- Built-in task manager with voice-to-task capture

The app now supports two runtime modes:
- Demo local mode (no backend required)
- Firebase mode (real auth + firestore)

## Repo Structure

- `app/` - main product app
- `landing/` - marketing landing page
- `extension/` - browser extension
- `docs/` - master documentation hub for PRD/spec/business/deploy
- Root docs: `PRD.md`, `Product Spec.md`, `Business.md`, `DESIGN.md`, `USER_WORKFLOWS.md`, `LAUNCH_CHECKLIST.md`

## Quick Start (No Backend)

Use this if you want to start using Track.now immediately.

1. Open terminal in `app/`
2. Install deps:
   - `npm install`
3. Run app:
   - `npm run dev`
4. Open the local URL shown in terminal
5. Create account from signup page

If Firebase keys are not configured, app automatically runs in local demo mode and stores data in browser local storage.

## Firebase Mode (Optional)

Set these env vars in `app/.env`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Then run `npm run dev` again.

## Build

Inside `app/`:
- `npm run lint`
- `npm run build`

Output is generated in `app/dist/spa`.

## Release Bundle

From repository root, run:
- `powershell -ExecutionPolicy Bypass -File scripts/prepare-release.ps1`
- Full pipeline (lint + build + package):
  - `powershell -ExecutionPolicy Bypass -File scripts/ship-all.ps1`

This creates `release/` with:
- Built app artifacts
- Landing page
- Extension
- Key docs

## Android Use

Fastest path for tomorrow:
- Deploy web app
- Install as PWA on Android (Add to Home Screen)

Detailed steps are in:
- `docs/DEPLOY_ANDROID_GUIDE.md`

## Documentation Hub

Start here:
- `docs/MASTER_INDEX.md`
- `docs/index.html`

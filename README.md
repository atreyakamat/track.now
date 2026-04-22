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

## Firebase Mode With Env Parity

Use separate Firebase projects for development and production.

1. Copy templates in `app/`:
   - `.env.development.example` -> `.env.development`
   - `.env.production.example` -> `.env.production`
2. Fill in real `VITE_FIREBASE_*` values for each project.
3. Keep `VITE_USE_DEMO_MODE=false` in both files when using Firebase.
4. Keep `VITE_REQUIRE_FIREBASE_IN_PROD=true` to fail fast if production keys are missing.

Then run `npm run dev` in `app/`.

## Build

Inside `app/`:
- `npm run lint`
- `npm run build`
- `npm run build:pwa`

Outputs are generated in:
- `app/dist/spa` for web SPA builds
- `app/dist/pwa` for installable offline PWA builds

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

## Production Deployment (Option C)

1. Add Firebase CLI config in repo root:
   - `.firebaserc.example` -> `.firebaserc`
   - Set your `development` and `production` project IDs.
2. Authenticate once:
   - `firebase login`
3. Deploy PWA hosting + Firestore rules:
   - `powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -ProjectId <your-production-project-id>`

If `firebase` is not installed globally, the deploy script automatically falls back to `npx firebase-tools`.

Useful variants:
- Rules only: `powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -RulesOnly -ProjectId <your-production-project-id>`
- Hosting only: `powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -HostingOnly -ProjectId <your-production-project-id>`

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

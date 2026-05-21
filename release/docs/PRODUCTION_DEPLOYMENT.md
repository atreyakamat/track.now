# Track.now Production Deployment

Date: 2026-04-19

This guide moves Track.now from demo/local mode to a real production Firebase deployment.

## 1. Set environment parity (dev vs prod)

From `app/`:

1. Copy templates:
   - `.env.development.example` -> `.env.development`
   - `.env.production.example` -> `.env.production`
2. Fill each file with the correct Firebase web config for that environment.
3. Keep these safety flags:
   - `VITE_USE_DEMO_MODE=false`
   - `VITE_REQUIRE_FIREBASE_IN_PROD=true`

Why this matters:
- You can test safely in a dedicated dev Firebase project.
- You avoid accidentally writing test data into production.

## 2. Configure Firebase CLI for this repo

At repo root:

1. Copy `.firebaserc.example` -> `.firebaserc`
2. Set your project IDs (`development`, `production`, and `default`).
3. Install and authenticate CLI:

```powershell
npm install -g firebase-tools
firebase login
```

If you do not install Firebase globally, the deploy script can also use `npx firebase-tools` automatically.

## 3. Build final installable PWA assets

From `app/`:

```powershell
npm install
npm run build:pwa
```

Build output:
- `app/dist/pwa`

Important generated files:
- `manifest.json`
- `sw.js`
- `icons/icon-maskable-192x192.png`
- `icons/icon-maskable-512x512.png`

## 4. Deploy Firestore rules + Hosting

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -ProjectId <your-production-project-id>
```

Optional deploy targets:

```powershell
# Only Firestore rules
powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -RulesOnly -ProjectId <your-production-project-id>

# Only hosting (skips rules)
powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -HostingOnly -ProjectId <your-production-project-id>
```

## 5. Point your custom domain

1. Open Firebase Console -> Hosting -> Add custom domain.
2. Follow DNS record instructions from Firebase.
3. Wait for SSL provisioning (usually minutes).
4. Re-test installability on your real domain over HTTPS.

## 6. Production verification checklist

- Auth signup/login works against production Firebase.
- Habit/task/completion CRUD works and survives refresh.
- Firestore rules block cross-user reads/writes.
- PWA installs and launches standalone from home screen.
- Service worker updates correctly after a redeploy.

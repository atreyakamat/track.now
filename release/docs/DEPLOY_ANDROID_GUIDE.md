# Deploy and Android Guide

Date: 2026-04-12

This guide has two paths:
- Path A: Install tomorrow on Android without backend (fastest).
- Path B: Build APK/AAB with Capacitor (store-ready path).

## Path A: Fastest (PWA Install)

## 1. Run locally

From `app/`:

```powershell
npm install
npm run dev
```

If Firebase env values are missing, the app runs in demo local mode automatically.

## 2. Access from phone

- Ensure phone and laptop are on same network.
- Start dev server with host exposed if needed:

```powershell
npx quasar dev --host 0.0.0.0 --port 9000
```

- Open `http://<your-laptop-ip>:9000` on Android Chrome.

## 3. Install as app

- In Chrome: menu -> "Add to Home screen" or "Install app"
- Launch from home screen like native app

This gives you immediate Android usage without Play Store packaging.

## 4. Production deploy (web host)

Build production bundle:

```powershell
npm run build:pwa
```

Deploy folder:
- `app/dist/pwa`

If deploying to Firebase Hosting + Firestore rules from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-firebase-production.ps1 -ProjectId <your-production-project-id>
```

Once deployed over HTTPS, Android install flow becomes stable and shareable.

## Path B: APK/AAB (Capacitor)

Use this when you want downloadable APK or Play Store release.

## 1. Add Capacitor mode (first time)

From `app/`:

```powershell
npx quasar mode add capacitor
```

## 2. Build Android project

```powershell
npx quasar build -m capacitor -T android
```

## 3. Open Android Studio

```powershell
npx quasar dev -m capacitor -T android
```

Then build signed APK/AAB in Android Studio.

## Notes

- APK/AAB requires Android SDK + Java + Android Studio configured.
- Real push/exact-time reliability is better with native notification plugins than plain web notifications.
- For "start using tomorrow", Path A is the recommended route.

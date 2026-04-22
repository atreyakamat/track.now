# Track.now Mobile (Expo)

This React Native app is now connected to the same Firebase backend used by the web app.

## Backend Integration Status

- Firebase Auth integrated:
  - Email + password sign in / sign up
  - Google sign in (OAuth + Firebase credential)
- Firestore realtime sync integrated:
  - tasks
  - habits
  - completions
  - friendships + users (for social list)
- Firestore actions integrated:
  - Toggle task completion
  - Toggle habit completion via completions records
  - Quick Add task (creates task document)

## 1) Environment Setup

1. In this folder, copy [.env.example](.env.example) to `.env`.
2. Fill all `EXPO_PUBLIC_FIREBASE_*` values from your Firebase project settings.
3. Fill Google OAuth client IDs:
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Example:

```bash
cd mobile
copy .env.example .env
```

## 2) Firebase Console Checks

1. Enable Auth providers:
   - Email/Password
   - Google
2. Ensure Firestore is enabled.
3. Confirm your Firestore rules allow the authenticated reads/writes used by:
   - tasks
   - habits
   - completions
   - friendships
   - users

## 3) Run On Phone (Expo Go)

1. Install Expo Go on your phone.
2. Connect phone and dev machine to the same network.
3. Start app:

```bash
cd mobile
npm install
npm start
```

4. Scan the QR code in terminal/browser using Expo Go.
5. Sign in with email/password (or Google if your OAuth redirect setup is valid for your runtime).

## 4) Notes About Google Sign-In

- Google sign-in depends on OAuth client and redirect configuration.
- If Google sign-in fails in Expo Go, email/password auth still works for end-to-end backend testing.
- For production-level Google auth parity, use an EAS dev build/release build with your Android package and iOS bundle identifiers.

## 5) Type Check

```bash
cd mobile
npx tsc --noEmit
```

## 6) Build Android (EAS)

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure
eas build -p android --profile preview
```

# Track.now Mobile (Expo)

This is the React Native app shell for Android deployment, aligned to the monochrome Track.now web redesign.

## What is implemented

- Premium monochrome visual system
- Auth flow screen (sign in + create account modes)
- Shared top app bar
- Shared bottom navigation with center add action
- Core tabs:
  - Today
  - Tasks
  - Habits
  - Planner
  - Activity (Social Pulse)

## Run locally

1. `cd mobile`
2. `npm install`
3. `npm run android`

If no emulator is running, start one from Android Studio first.

## Build Android APK/AAB with EAS

1. Install EAS CLI:
   - `npm install -g eas-cli`
2. Login:
   - `eas login`
3. Initialize once in this folder:
   - `cd mobile`
   - `eas build:configure`
4. Build Android:
   - `eas build -p android --profile preview`

For Play Store submission, use an AAB profile (usually `production`) in `eas.json`.

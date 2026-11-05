# Track.now — mobile release guide

Everything the app needs is configured (EAS project, channels, env vars, OTA updates).
The remaining steps need **your** developer accounts, so they can't be automated for you.

## What's already set up
- EAS project `@atreyakamat/tracknow` (`eas.json` has `development`, `preview`, `production`).
- Supabase env vars pushed to all EAS environments (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- OTA updates (expo-updates) on the `production`/`preview` channels — JS-only fixes can ship without a store resubmission via `eas update`.
- `preview` builds an installable **APK**; `production` builds an **AAB** for the Play Store.

## Android → Google Play (one-time)
1. Create a **Google Play Developer account** (one-time $25) at https://play.google.com/console.
2. Create the app in Play Console (package `dev.atreyakamat.tracknow`), fill store listing, content rating, data-safety form, and a **privacy policy URL** (required).
3. Create a **service account key** for automated submission:
   - Play Console → Setup → API access → create/link a Google Cloud service account → grant "Release manager" → download the JSON.
   - Save it somewhere local and set the path in `eas.json` under `submit.production.android.serviceAccountKeyPath`, **or** pass it at submit time.
4. Build the production bundle:
   ```
   eas build --profile production --platform android
   ```
5. Submit (first submission usually must be uploaded manually to create the release track; afterwards):
   ```
   eas submit --profile production --platform android
   ```

## iOS → App Store (optional; needs a Mac-free EAS cloud build + Apple account)
1. **Apple Developer Program** membership ($99/yr).
2. `eas build --profile production --platform ios` (EAS handles signing in the cloud).
3. `eas submit --profile production --platform ios` (App Store Connect app + metadata required).

## Shipping updates after launch
- **JS/asset-only change** (most fixes, copy, screens): `eas update --branch production --message "..."` → reaches installed apps on next open. No store review.
- **Native change** (new native module, app.json native config, SDK bump): a new store build + submission is required.

## Versioning
- `app.json` `version` is the user-facing version; `runtimeVersion.policy = "appVersion"` ties OTA updates to it.
- Bump `version` when you ship a native build; OTA updates must target the same runtime version as the installed build.

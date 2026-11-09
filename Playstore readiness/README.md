# Play Store readiness — Track.now

Everything needed to list the Android app on Google Play, in the order you will use it.
Package: `dev.atreyakamat.tracknow` · Version 1.0.0 · Built with Expo (EAS).

## What is in this folder

| Path | What it is |
| :--- | :--- |
| `listing/` | Title, short and full description, release notes, tags. Paste into Play Console → Main store listing. |
| `graphics/icon-512.png` | High-res icon (512 × 512, PNG). |
| `graphics/feature-graphic-1024x500.png` | Feature graphic (1024 × 500). |
| `screenshots/phone/` | Eight phone screenshots, 1080 × 1920, captioned, ready to upload. |
| `screenshots/raw/` | The same screens without captions or frames, for other uses (website, social). |
| `data-safety.md` | Answers for the Data safety form. |
| `content-rating.md` | Answers for the content rating questionnaire. |
| `CHECKLIST.md` | Step-by-step release checklist with what is done and what needs you. |

The screenshots are captured from the phone app itself (its web build, with made-up demo data and no connection to the live project) by `node scripts/render_store_screenshots.cjs`. Re-run it after any visual change. Before the final submission, replace any screenshot you like with a capture from a real device; the captions and order can stay.

## The short version

1. Create a Google Play developer account (one-time USD 25) and a new app: **Track.now**, default language English, App, Free.
2. Build the release bundle: `cd apps/mobile && npx eas-cli build --profile production --platform android` (produces an `.aab`).
3. Upload the `.aab` to **Internal testing** first; add yourself as a tester and install from the Play link.
4. Fill in the store listing from `listing/`, upload `graphics/` and `screenshots/phone/`.
5. Complete App content: privacy policy URL, Data safety (`data-safety.md`), content rating (`content-rating.md`), target audience 13+, no ads.
6. Promote Internal → Closed testing (Google requires 12 testers for 14 days on new personal accounts) → Production.

Details and the status of each step: `CHECKLIST.md`.

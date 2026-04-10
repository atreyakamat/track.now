# Track.now Launch Checklist

## Required credentials

- Firebase web config values in `app/.env`
- Firebase Authentication enabled for email/password
- Firestore security rules reviewed for `users`, `habits`, `completions`, `friendships`, and `groups`
- Real production domain for the landing page and app

## Recommended next integrations

- Stripe checkout + webhook backend for real billing
- WhatsApp provider credentials for live reminder delivery
- Capacitor notification setup for Android exact-time reminders
- Production Firebase project for extension/app sync

## Before publishing

- Build the Quasar app: `npm run build` inside `app`
- Load the extension from `extension/` in Chrome
- Add production URLs to landing and extension links if they differ from `tracknow.app`

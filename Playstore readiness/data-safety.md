# Data safety form — answers

Play Console → Policy → App content → Data safety.

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS to Supabase).
**Do you provide a way for users to request that their data is deleted?** Yes.
- In the app/web: Settings → Delete account (removes the account and every row immediately).
- URL: https://trackapp.atreyakamat.dev/settings

## Data types

| Category | Type | Collected | Shared | Processed ephemerally | Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Personal info | Email address | Yes | No | No | Required | Account management (sign-in) |
| Personal info | Name (display name) | Yes | No | No | Optional | App functionality (shown in the app and on a Plan the user chooses to share) |
| App activity | Other user-generated content (tracks, plans, items, completions, review notes the user types in) | Yes | No | No | Required | App functionality |
| App activity | App interactions (which features are used: tour, quests, templates, Plan created or shared) | Yes | No | No | Optional (Settings → Share usage and error reports) | Analytics |
| App info and performance | Crash logs, diagnostics (error name, message, stack trace, app version) | Yes | No | No | Optional (same switch) | Analytics (finding and fixing bugs) |
| Device or other IDs | Device ID / advertising ID | No | No | — | — | Not collected |
| Location, contacts, photos, files, messages, audio, health, financial info, calendar, web history | — | No | No | — | — | Not collected |

Notes for the form:
- "Shared" means transferred to a third party. Supabase is the hosting/database service provider acting on the developer's behalf, which Google does not count as sharing.
- Reminders, notification settings, preferences and skips live only on the device and are never transmitted.
- Review notes and Today's focus are stored on the device and, once migration `20261111000000` is applied, in the user's own rows on Supabase so they follow the account.
- Usage events and error reports are first-party (table `track_now_client_events`, migration `20261110000000`), linked to the user's account id, never contain typed text, and can be switched off in Settings. **Changed on 2026-11-10: update the Data safety form in Play Console to match the two new rows above before shipping a build that includes them.**
- Share links are created only by the user; anyone with the link sees that single Plan, read-only, until the user revokes it.
- No ads SDK, no third-party analytics SDK, no cross-app tracking.

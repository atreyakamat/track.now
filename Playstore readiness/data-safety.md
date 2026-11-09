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
| App activity | Other user-generated content (tracks, plans, items, completions the user types in) | Yes | No | No | Required | App functionality |
| App info and performance | Crash logs, diagnostics | No | No | — | — | Not collected by the app |
| Device or other IDs | Device ID / advertising ID | No | No | — | — | Not collected |
| Location, contacts, photos, files, messages, audio, health, financial info, calendar, web history | — | No | No | — | — | Not collected |

Notes for the form:
- "Shared" means transferred to a third party. Supabase is the hosting/database service provider acting on the developer's behalf, which Google does not count as sharing.
- Reminders, notification settings, review notes, preferences, skips and Focus live only on the device and are never transmitted.
- Share links are created only by the user; anyone with the link sees that single Plan, read-only, until the user revokes it.
- No ads SDK, no analytics SDK, no tracking.

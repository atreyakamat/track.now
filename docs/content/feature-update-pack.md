# Track.now: feature update content pack

*Written 10 November 2026. Ready to post. Every claim below is true of the build on `main` today; the notes at the end say what to check first.*

The story in one line: **Track.now now reacts the instant you tap, remembers your reviews on every device, and celebrates real progress without ever punishing a miss.**

Voice (from the playbook): calm, honest, no hype, no fake streaks. Show the real screen. Link in bio goes to the landing page with `?utm_source=<platform>`.

---

## 1. Release notes (store listing and in-app)

**What's new**
- Ticks are instant. Tap a habit, task or counter and it changes on the spot, even on a slow connection. The save happens in the background, and if it fails you are told and nothing is left half-done.
- Your review notes and today's focus now follow your account, so the phone and the web agree.
- Achievement toasts when you earn something new, plus two new ones: Thirty in a row and Five milestones.
- A short recap of your last week, shown once.
- A one-line status under "N of M done". After a week away it says welcome back, nothing else.
- Optional usage and error reports (Settings, on by default, never your item names or notes) so bugs get fixed faster.

Short version (500 characters): *Instant ticks, review notes and focus that sync between phone and web, achievement toasts, a weekly recap, and a welcome back after a break. Nothing ever takes points away.*

---

## 2. X / Threads thread (build in public)

1. I rebuilt how ticking works in Track.now. Before: tap, wait for the server, then see the tick. Now: the tick shows the moment you tap, and the save happens behind it. 🧵
2. The old way took six requests in a row for one habit tick. On a slow connection that felt broken. Now it is three, and you never wait for them.
3. Fast taps used to get dropped. Now tick, un-tick, tick ends ticked, and three quick +1s count exactly three. I tested it against a deliberately slow fake server.
4. If a save fails, you get a message and the tick rolls back to what is really stored. No silent lies.
5. New: your weekly review notes and today's focus follow your account. Write on your phone, read on the web.
6. New: when you earn an achievement you hear about it once. Last week's recap shows what you finished, and says nothing if the week was empty. Points are never taken away.
7. Free on web, Android preview build available. Link in bio.

---

## 3. Reddit post (r/SideProject, r/productivity)

**Title:** I got tired of a habit tracker that made me wait for every tick, so I rebuilt it to react instantly

**Body:**
I've been building Track.now, a planner for 30/60/90-day "Arcs" with honest progress (no fake streaks, nothing takes points away).

The thing that annoyed me most in my own app: tapping a habit and watching nothing happen for a second. The screen was waiting for the server. I changed it so the tap shows immediately and the save runs in the background, in order, with a clear message and a rollback if it fails.

Also new this week:
- Review notes and daily focus sync between phone and web
- A once-a-week recap of what you actually finished
- Achievement toasts (first-time unlocks only)

It's free on the web, and there's an Android preview build. Honest feedback welcome: what would make you tick things off more often?

*(Check each subreddit's self-promotion rules before posting. Post as your personal account.)*

---

## 4. Short video scripts (Reels / TikTok / Shorts, 20 to 30 seconds)

**Video A: "The tap that doesn't wait"**
- Hook (0 to 2 s), on screen: "Your habit app makes you wait."
- Screen recording of a throttled network: old behaviour is not available, so show the new one: tap, tick is instant, small "saving" shown afterwards.
- Voiceover: "Tap. Done. The save happens behind it."
- End card: "Track.now. Honest progress. Free."

**Video B: "A week away. No guilt."**
- Hook: "I disappeared for 9 days."
- Show opening the app: "Welcome back. One small thing today is a fine restart."
- Voiceover: "No broken streak. No lost points. Just a way back in."
- End card: "Nothing here ever takes points away."

**Video C: "Phone and laptop, same notes"**
- Hook: "Write your weekly review on your phone."
- Cut to the laptop opening Reviews, the same notes already there.
- Voiceover: "Reviews and today's focus follow you."
- End card: link in bio.

*(Video can be generated or edited with an AI video tool once you sign in to one, but real screen recordings of your own app will do better and are always accurate.)*

---

## 5. Instagram / LinkedIn caption

> Small change, big difference: ticks in Track.now are now instant. Your reviews and daily focus follow you between phone and web. And when you come back after a break, the app just says welcome back. Free on the web, Android preview in the link. What would you want it to track next?
>
> #habittracker #winterarc #productivity #buildinpublic #indiedev

---

## 6. Newsletter blurb ("The Arc Letter")

**Subject:** Tap, and it's done

This week's update to Track.now is about respect for your time. Ticks are now instant, even on a bad connection. Your weekly review notes and today's focus sync between phone and web. You'll get a quiet toast when you earn a new achievement, a short recap of last week, and a plain "welcome back" after a break.

It still never takes points away. [Open Track.now]

---

## Check before you post
- **Android:** say "Android preview build", not "on Google Play". The store listing is not live yet.
- **Sync:** it works only for accounts on a database that has the synced-state migration. You have said yours does; confirm on two devices before you promise it publicly.
- **Screens:** record from the current build. Close and reopen the phone app twice so it picks up the newest update.
- **Usage reports:** if anyone asks, they are first-party, on by default, switchable in Settings. The privacy page says so.
- **Numbers:** don't quote speeds or user counts. Show the screen instead.

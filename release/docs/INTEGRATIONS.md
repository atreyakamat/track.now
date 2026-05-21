# 🔌 Track.now Integration Guide

This document explains how to set up and use the new integrations added to Track.now.

---

## 🎙️ 1. Enhanced Voice AI
The Voice AI allows you to speak tasks and habits naturally. It includes NLP (Natural Language Processing) for priority/category detection and TTS (Text-to-Speech) for feedback.

### Features
- **Priority Detection:** Keywords like "urgent", "must", or "high priority" set the task to high.
- **Category Auto-matching:** Keywords like "gym", "code", or "bill" automatically assign the right category.
- **Voice Feedback:** The app confirms what it heard using your browser's voice.

### User Action
1. Tap the **Microphone icon** on the dashboard.
2. Say: *"Remind me to pay the electricity bill tomorrow at 10am, high priority."*
3. The app will confirm: *"I heard 'Pay the electricity bill' for 2026-05-03. Is that correct?"*

---

## 📅 2. Google Calendar Sync
Sync your Track.now tasks and habits directly to your personal Google Calendar.

### Setup (Admin/Developer)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Calendar API**.
3. Create **OAuth 2.0 Client ID** (Web) and an **API Key**.
4. Add to your `.env` file:
   - `VITE_GOOGLE_API_KEY`
   - `VITE_GOOGLE_CLIENT_ID`

### Setup (User)
1. Go to **Settings**.
2. Toggle **Calendar Sync** to ON.
3. Authenticate with your Google account when prompted.

---

## 🔔 3. Telegram & Discord Webhooks
Receive mission alerts directly in your favorite chat apps.

### Discord Setup
1. Open Discord > Server Settings > Integrations > Webhooks.
2. Create a "New Webhook" and copy the **Webhook URL**.
3. Paste this URL into **Track.now Settings** under "Discord Webhook URL".

### Telegram Setup
1. Create a bot via [@BotFather](https://t.me/botfather) and get your **API Token**.
2. Get your **Chat ID** (e.g., via [@userinfobot](https://t.me/userinfobot)).
3. Construct your URL: `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>`
4. Paste this URL into **Track.now Settings** under "Telegram Webhook URL".

---

## 🛠️ Developer Notes
- **Local Sync:** If `VITE_USE_DEMO_MODE=true`, data is stored in `localStorage` but integrations still attempt to fire (e.g., Webhooks and Calendar).
- **Service Workers:** Webhooks fire from the `notificationService`, ensuring they trigger alongside system notifications.

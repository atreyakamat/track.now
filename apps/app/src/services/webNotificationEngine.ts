import {
  collectDueReminders,
  getRemindersKey,
  reconcileRemindersWithSnapshot,
  rescheduleRecurringAfterDelivery,
} from './reminderService'
import { loadNotificationPreferences } from './notificationPreferences'
import type { ItemReminder } from '@/types/notifications'
import {
  buildDailyBriefing,
  buildOverdueAlert,
  shouldRunDaily,
  type DailyAlert,
  type DailySnapshot,
} from '@/domain/briefing'
import { getTodayDateString } from '@/domain/dates'

/**
 * Client-side reminder delivery.
 *
 * Honest capability boundary: this engine runs only while Track.now is open in a browser
 * tab (foreground or background). A timer cannot wake a closed browser, and there is no
 * Web Push subscription/sender in this project, so reminders that come due while the app is
 * closed are delivered on the next open ("catch-up", capped with a digest; anything overdue
 * by more than a day is only summarised).
 *
 * Multiple tabs: a reminder is claimed by exactly one tab (Web Locks when available, else a
 * short localStorage claim). Only a visible tab shows in-app alerts (toasts). When no tab is
 * visible and system notifications are enabled, a hidden tab delivers it as a system
 * notification once; otherwise the reminder waits until a tab becomes visible.
 *
 * In-app alerts are shown for reminders the user explicitly set. System (browser)
 * notifications are additionally shown only when the user enabled them in Settings AND the
 * browser granted permission.
 */

let swRegistration: ServiceWorkerRegistration | null = null
const SW_READY_TIMEOUT_MS = 1500
const SWEEP_INTERVAL_MS = 20_000
/** Server reconciliation (items completed/deleted/archived elsewhere) cadence. */
export const RECONCILE_INTERVAL_MS = 10 * 60 * 1000
const RECONCILE_TIMEOUT_MS = 10_000
/** A visible tab refreshes its heartbeat every sweep; older heartbeats are ignored. */
const VISIBLE_HEARTBEAT_TTL_MS = 45_000
const STORAGE_LOCK_TTL_MS = 10_000

const TAB_ID = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    swRegistration = reg
    return reg
  } catch {
    return null
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Requests browser notification permission after an explicit user interaction. */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

/** Same-origin, path-only navigation targets (no `//host`, no backslashes, no schemes). */
export function isSafeInAppPath(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return false
  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://app.invalid'
    return new URL(url, base).origin === base
  } catch {
    return false
  }
}

/** Shows a system notification if supported and permitted. Returns whether one was shown. */
export async function dispatchBrowserNotification(
  title: string,
  options?: { body?: string; data?: { url?: string; [key: string]: unknown }; tag?: string },
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false

  const notificationOptions: NotificationOptions = {
    body: options?.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: options?.data || { url: '/today' },
    tag: options?.tag,
  }

  try {
    const reg =
      swRegistration ??
      (navigator.serviceWorker ? await withTimeout(navigator.serviceWorker.ready, SW_READY_TIMEOUT_MS) : null)
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, notificationOptions)
      return true
    }
    const n = new Notification(title, notificationOptions)
    n.onclick = (e) => {
      e.preventDefault()
      window.focus()
      const url = options?.data?.url
      if (isSafeInAppPath(url) && window.location.pathname !== url) {
        window.dispatchEvent(new CustomEvent('tracknow:navigate', { detail: { url } }))
      }
      n.close()
    }
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------------------
// Cross-tab coordination
// ---------------------------------------------------------------------------------------

const visibleKey = (userId: string) => `tracknow_visible_tab_${userId}`
const lockKey = (userId: string) => `tracknow_reminder_lock_${userId}`

function readStamp(key: string): { owner: string; at: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { owner?: unknown; at?: unknown }
    if (typeof parsed?.owner !== 'string' || typeof parsed.at !== 'number') return null
    return { owner: parsed.owner, at: parsed.at }
  } catch {
    return null
  }
}

/** Records that this tab is visible (heartbeat), or withdraws its heartbeat when hidden. */
export function updateVisibilityHeartbeat(userId: string, visible: boolean, now = Date.now(), tabId = TAB_ID): void {
  try {
    if (visible) {
      localStorage.setItem(visibleKey(userId), JSON.stringify({ owner: tabId, at: now }))
    } else if (readStamp(visibleKey(userId))?.owner === tabId) {
      localStorage.removeItem(visibleKey(userId))
    }
  } catch {
    /* storage unavailable: each tab behaves independently */
  }
}

export function isAnotherTabVisible(userId: string, now = Date.now(), tabId = TAB_ID): boolean {
  const stamp = readStamp(visibleKey(userId))
  return Boolean(stamp && stamp.owner !== tabId && now - stamp.at < VISIBLE_HEARTBEAT_TTL_MS)
}

export type DeliveryMode = 'inapp' | 'system' | 'skip'

/**
 * Visible tab: in-app alerts (plus a system notification when allowed).
 * Hidden tab: system notification only, and only when no other tab is visible; otherwise the
 * reminder is left for the visible tab (or for when this tab becomes visible).
 */
export function resolveDeliveryMode(
  userId: string,
  env: { visible: boolean; allowBrowser: boolean; now?: number; tabId?: string },
): DeliveryMode {
  if (env.visible) return 'inapp'
  if (isAnotherTabVisible(userId, env.now ?? Date.now(), env.tabId ?? TAB_ID)) return 'skip'
  return env.allowBrowser ? 'system' : 'skip'
}

function claimStorageLock(userId: string, tabId: string): boolean {
  try {
    const now = Date.now()
    const current = readStamp(lockKey(userId))
    if (current && current.owner !== tabId && now - current.at < STORAGE_LOCK_TTL_MS) return false
    localStorage.setItem(lockKey(userId), JSON.stringify({ owner: tabId, at: now }))
    return readStamp(lockKey(userId))?.owner === tabId
  } catch {
    return true // storage unavailable: no other tab can share state with us anyway
  }
}

function releaseStorageLock(userId: string, tabId: string): void {
  try {
    if (readStamp(lockKey(userId))?.owner === tabId) localStorage.removeItem(lockKey(userId))
  } catch {
    /* ignore */
  }
}

interface LockManagerLike {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => unknown,
  ) => Promise<unknown>
}

/**
 * Runs `fn` while holding the per-user reminder lock. Returns null (without running `fn`) when
 * another tab holds it; the next sweep retries.
 */
export async function withReminderLock<T>(userId: string, fn: () => T, tabId = TAB_ID): Promise<T | null> {
  const locks =
    typeof navigator !== 'undefined' ? (navigator as unknown as { locks?: LockManagerLike }).locks : undefined
  if (locks && typeof locks.request === 'function') {
    try {
      const result = await locks.request(`tracknow-reminders-${userId}`, { ifAvailable: true }, (lock) =>
        lock ? { value: fn() } : null,
      )
      return result ? (result as { value: T }).value : null
    } catch {
      // Fall through to the storage claim if the Web Locks API misbehaves.
    }
  }
  if (!claimStorageLock(userId, tabId)) return null
  try {
    return fn()
  } finally {
    releaseStorageLock(userId, tabId)
  }
}

// ---------------------------------------------------------------------------------------
// Digest state (daily briefing / overdue alert)
// ---------------------------------------------------------------------------------------

const DIGEST_STATE_PREFIX = 'tracknow_digest_state_'
interface DigestState {
  briefing?: string
  overdue?: string
}

function loadDigestState(userId: string): DigestState {
  try {
    const raw = localStorage.getItem(`${DIGEST_STATE_PREFIX}${userId}`)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as DigestState) : {}
  } catch {
    return {}
  }
}

function saveDigestState(userId: string, state: DigestState): void {
  try {
    localStorage.setItem(`${DIGEST_STATE_PREFIX}${userId}`, JSON.stringify(state))
  } catch {
    /* non-critical */
  }
}

export type DigestKind = 'overflow' | 'briefing' | 'overdue'

export interface NotificationMonitorHandlers {
  /** Called for each reminder delivered in-app (visible tab only). */
  onReminder?: (reminder: ItemReminder) => void
  /** Called for digests: overflow catch-up, daily briefing, overdue alert. */
  onDigest?: (alert: DailyAlert & { kind: DigestKind }) => void
  /**
   * Loads the COMPLETE list of active items and today's completions. Used for the daily
   * briefing / overdue alert and to reconcile reminders with server state.
   */
  loadDailySnapshot?: () => Promise<DailySnapshot>
}

type BrowserNotifier = typeof dispatchBrowserNotification

export function buildOverflowDigest(overflow: ItemReminder[]): DailyAlert {
  const names = overflow.slice(-3).map((r) => r.itemName).join(', ')
  return {
    title: `${overflow.length} earlier reminder${overflow.length === 1 ? '' : 's'} while you were away`,
    body: overflow.length > 3 ? `${names} and ${overflow.length - 3} more.` : `${names}.`,
  }
}

export interface ReminderSweepOptions {
  mode: DeliveryMode
  allowBrowser: boolean
  now?: Date
  isStopped?: () => boolean
  onReminder?: NotificationMonitorHandlers['onReminder']
  onDigest?: NotificationMonitorHandlers['onDigest']
  notify?: BrowserNotifier
  tabId?: string
}

export interface ReminderSweepResult {
  deliver: ItemReminder[]
  overflow: ItemReminder[]
}

/**
 * One delivery pass. Claiming (collectDueReminders marks reminders delivered) and in-app
 * delivery happen synchronously inside the cross-tab lock, before any await, so a reminder
 * that was claimed is always shown even if the monitor is stopped right afterwards (React
 * StrictMode cleanup, navigation). Recurring re-arming is isolated per reminder. System
 * notifications for claimed reminders are sent afterwards.
 */
export async function runReminderSweep(userId: string, options: ReminderSweepOptions): Promise<ReminderSweepResult> {
  const empty: ReminderSweepResult = { deliver: [], overflow: [] }
  if (!userId || options.mode === 'skip') return empty
  const now = options.now ?? new Date()
  const notify = options.notify ?? dispatchBrowserNotification
  const inApp = options.mode === 'inapp'

  const claimed = await withReminderLock(
    userId,
    () => {
      if (options.isStopped?.()) return empty
      const sweep = collectDueReminders(userId, now)
      if (sweep.deliver.length === 0 && sweep.overflow.length === 0) return sweep

      if (inApp) {
        for (const rem of sweep.deliver) {
          try {
            options.onReminder?.(rem)
          } catch {
            /* a failing UI callback must not block the remaining reminders */
          }
        }
        if (sweep.overflow.length > 0) {
          try {
            options.onDigest?.({ ...buildOverflowDigest(sweep.overflow), kind: 'overflow' })
          } catch {
            /* ignore */
          }
        }
      }

      try {
        rescheduleRecurringAfterDelivery(userId, [...sweep.deliver, ...sweep.overflow], now)
      } catch {
        /* per-reminder failures are already isolated; never drop the delivery */
      }

      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        for (const rem of sweep.deliver) {
          window.dispatchEvent(new CustomEvent('tracknow:reminder-fired', { detail: { reminder: rem } }))
        }
      }
      return sweep
    },
    options.tabId,
  )
  if (!claimed) return empty

  // System notifications for everything this tab claimed, even if the monitor stopped
  // meanwhile: dropping them here would lose reminders that are already marked delivered.
  if (options.allowBrowser) {
    for (const rem of claimed.deliver) {
      const url = rem.planId ? `/plans/${rem.planId}` : '/today'
      try {
        await notify(`Reminder: ${rem.itemName}`, {
          body: 'Scheduled execution reminder in Track.now.',
          data: { url, itemId: rem.itemId },
          tag: `reminder-${rem.id}`,
        })
      } catch {
        /* ignore */
      }
    }
    if (claimed.overflow.length > 0) {
      const alert = buildOverflowDigest(claimed.overflow)
      try {
        await notify(alert.title, { body: alert.body, data: { url: '/today' }, tag: 'reminder-digest' })
      } catch {
        /* ignore */
      }
    }
  }
  return claimed
}

/**
 * Loads server state and cancels/advances stale reminders. On any load failure (offline,
 * timeout) nothing is cancelled: a network error must never wipe reminders.
 * Returns whether reconciliation actually ran.
 */
export async function reconcileRemindersFromServer(
  userId: string,
  load: () => Promise<DailySnapshot>,
  options: { timeoutMs?: number; now?: () => Date; isStopped?: () => boolean } = {},
): Promise<boolean> {
  let snapshot: DailySnapshot | null = null
  try {
    snapshot = await withTimeout(load(), options.timeoutMs ?? RECONCILE_TIMEOUT_MS)
  } catch {
    snapshot = null
  }
  if (!snapshot || !Array.isArray(snapshot.items) || !Array.isArray(snapshot.completedTodayIds)) return false
  if (options.isStopped?.()) return false
  try {
    reconcileRemindersWithSnapshot(userId, snapshot.items, snapshot.completedTodayIds, options.now?.() ?? new Date())
    return true
  } catch {
    return false
  }
}

const isDocumentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
const browserNotificationsAllowed = (masterEnabled: boolean) =>
  masterEnabled && isNotificationSupported() && Notification.permission === 'granted'

/**
 * Starts the reminder delivery loop for one user. Reconciles with the server first (and every
 * 10 minutes), then sweeps immediately, every 20 s while the page is alive, and on
 * focus/visibility (catch-up after the tab was hidden or the device slept). Returns a cleanup
 * function that stops this monitor instance only.
 */
export function startNotificationMonitor(
  userId: string,
  handlersOrCallback?: NotificationMonitorHandlers | ((reminder: ItemReminder) => void),
): () => void {
  if (!userId || typeof window === 'undefined') return () => {}
  const handlers: NotificationMonitorHandlers =
    typeof handlersOrCallback === 'function' ? { onReminder: handlersOrCallback } : handlersOrCallback ?? {}

  let stopped = false
  let running = false
  let lastReconcileAttempt = 0
  const isStopped = () => stopped

  const runDailyAlerts = async (mode: DeliveryMode, allowBrowser: boolean) => {
    const prefs = loadNotificationPreferences(userId)
    if (!prefs.masterEnabled || !handlers.loadDailySnapshot || mode === 'skip') return
    const wantsBriefing = prefs.dailySummaryEnabled
    const wantsOverdue = prefs.overdueRemindersEnabled
    if (!wantsBriefing && !wantsOverdue) return

    const now = new Date()
    const state = loadDigestState(userId)
    const runBriefing = wantsBriefing && shouldRunDaily(state.briefing, prefs.dailySummaryTime, now)
    const runOverdue = wantsOverdue && shouldRunDaily(state.overdue, prefs.dailySummaryTime, now)
    if (!runBriefing && !runOverdue) return

    // Mark first so concurrent sweeps/tabs do not duplicate today's alerts.
    const today = getTodayDateString(now)
    saveDigestState(userId, {
      ...state,
      ...(runBriefing ? { briefing: today } : {}),
      ...(runOverdue ? { overdue: today } : {}),
    })

    let snapshot: DailySnapshot
    try {
      snapshot = await handlers.loadDailySnapshot()
    } catch {
      // Could not load data (offline): allow a retry on a later sweep today.
      saveDigestState(userId, state)
      return
    }
    if (stopped) {
      // Stopped mid-load (sign-out, left the app shell): nothing was shown, so let a later
      // session show today's briefing instead of losing it for the day.
      saveDigestState(userId, state)
      return
    }

    const showInApp = mode === 'inapp'
    if (runBriefing) {
      const alert = buildDailyBriefing(snapshot, now)
      if (showInApp) handlers.onDigest?.({ ...alert, kind: 'briefing' })
      if (allowBrowser) await dispatchBrowserNotification(alert.title, { body: alert.body, data: { url: '/today' }, tag: `briefing-${today}` })
    }
    if (runOverdue) {
      const alert = buildOverdueAlert(snapshot, now)
      if (alert) {
        if (showInApp) handlers.onDigest?.({ ...alert, kind: 'overdue' })
        if (allowBrowser) await dispatchBrowserNotification(alert.title, { body: alert.body, data: { url: '/today' }, tag: `overdue-${today}` })
      }
    }
  }

  const runSweep = async () => {
    if (stopped || running) return
    running = true
    try {
      const visible = isDocumentVisible()
      updateVisibilityHeartbeat(userId, visible)
      const prefs = loadNotificationPreferences(userId)
      const allowBrowser = browserNotificationsAllowed(prefs.masterEnabled)
      const mode = resolveDeliveryMode(userId, { visible, allowBrowser })
      if (mode === 'skip') return

      // Reconcile with the server before the first delivery and every 10 minutes, so items
      // completed/deleted/archived elsewhere never fire. Failures never cancel anything.
      if (handlers.loadDailySnapshot && Date.now() - lastReconcileAttempt >= RECONCILE_INTERVAL_MS) {
        lastReconcileAttempt = Date.now()
        const ok = await reconcileRemindersFromServer(userId, handlers.loadDailySnapshot, { isStopped })
        if (stopped) return
        // Offline / failed: keep delivering, and retry reconciliation in about a minute.
        if (!ok) lastReconcileAttempt = Date.now() - RECONCILE_INTERVAL_MS + 60_000
      }

      if (prefs.remindersEnabled) {
        await runReminderSweep(userId, {
          mode,
          allowBrowser,
          isStopped,
          onReminder: handlers.onReminder,
          onDigest: handlers.onDigest,
        })
      }
      if (!stopped) await runDailyAlerts(mode, allowBrowser)
    } catch {
      /* never let one failed sweep kill the loop */
    } finally {
      running = false
    }
  }

  void runSweep()
  const intervalId = setInterval(() => void runSweep(), SWEEP_INTERVAL_MS)
  const handleVisibilityChange = () => {
    const visible = isDocumentVisible()
    updateVisibilityHeartbeat(userId, visible)
    if (visible) void runSweep()
  }
  const handleFocus = () => void runSweep()
  // Another tab changed this user's reminders: refresh reminder chips in this tab.
  const handleStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== getRemindersKey(userId)) return
    window.dispatchEvent(new CustomEvent('tracknow:reminders-updated', { detail: { userId, source: 'storage' } }))
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocus)
  window.addEventListener('storage', handleStorage)

  return () => {
    stopped = true
    clearInterval(intervalId)
    updateVisibilityHeartbeat(userId, false)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('storage', handleStorage)
  }
}

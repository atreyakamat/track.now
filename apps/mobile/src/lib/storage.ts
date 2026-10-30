import * as SQLite from 'expo-sqlite'
import { configureStorage, type KeyValueStorage } from '@tracknow/core/platform/storage'

/**
 * Synchronous device-local key-value store for @tracknow/core (reminders, notification
 * preferences, review notes). Core's storage interface is synchronous — the web uses
 * localStorage — so on the device we back it with expo-sqlite's synchronous (JSI) API,
 * which works in Expo Go and needs no preloading. Data is namespaced per user by the keys
 * core writes (e.g. `tracknow_reminders_<userId>`).
 */
const db = SQLite.openDatabaseSync('tracknow.db')
db.execSync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)')

const storage: KeyValueStorage = {
  getItem(key) {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)
    return row ? row.value : null
  },
  setItem(key, value) {
    db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value)
  },
  removeItem(key) {
    db.runSync('DELETE FROM kv WHERE key = ?', key)
  },
  keys() {
    return db.getAllSync<{ key: string }>('SELECT key FROM kv').map((row) => row.key)
  },
}

/** Registers device storage with core. Call once, before any core service runs. */
export function installStorage(): void {
  configureStorage(storage)
}

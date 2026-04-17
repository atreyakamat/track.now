const STORAGE_KEYS = {
  users: 'tracknow_demo_users',
  currentUser: 'tracknow_demo_current_user',
  habits: 'tracknow_demo_habits',
  tasks: 'tracknow_demo_tasks',
  completions: 'tracknow_demo_completions',
  friendships: 'tracknow_demo_friendships',
  groups: 'tracknow_demo_groups'
}

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function createDemoId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function getDemoCollection(name) {
  return readJson(STORAGE_KEYS[name], [])
}

export function setDemoCollection(name, value) {
  writeJson(STORAGE_KEYS[name], value)
}

export function getDemoUsers() {
  return getDemoCollection('users')
}

export function saveDemoUsers(users) {
  setDemoCollection('users', users)
}

export function getDemoCurrentUser() {
  return readJson(STORAGE_KEYS.currentUser, null)
}

export function setDemoCurrentUser(user) {
  writeJson(STORAGE_KEYS.currentUser, user)
}

export function clearDemoCurrentUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEYS.currentUser)
}

export function getDemoProfile(uid) {
  return getDemoUsers().find((user) => user.uid === uid) || null
}

export function updateDemoProfile(uid, updates) {
  const users = getDemoUsers()
  const nextUsers = users.map((user) => user.uid === uid ? { ...user, ...updates } : user)
  saveDemoUsers(nextUsers)
  const currentUser = getDemoCurrentUser()

  if (currentUser?.uid === uid) {
    setDemoCurrentUser({
      ...currentUser,
      ...('displayName' in updates ? { displayName: updates.displayName } : {})
    })
  }

  return nextUsers.find((user) => user.uid === uid) || null
}

export function upsertDemoItem(name, item) {
  const items = getDemoCollection(name)
  const existingIndex = items.findIndex((entry) => entry.id === item.id)

  if (existingIndex >= 0) {
    items[existingIndex] = item
  } else {
    items.push(item)
  }

  setDemoCollection(name, items)
  return item
}

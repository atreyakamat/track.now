import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User
} from 'firebase/auth'
import { auth, db, hasFirebaseConfig } from './src/firebase'

WebBrowser.maybeCompleteAuthSession()

type AuthMode = 'signin' | 'signup'
type TabKey = 'today' | 'tasks' | 'habits' | 'planner' | 'activity'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

type UserProfile = {
  uid: string
  name: string
  email: string
  plan: string
}

type Task = {
  id: string
  title: string
  priority: TaskPriority
  completed: boolean
  dueDate: string
  dueTime: string
  createdAt: number
}

type Habit = {
  id: string
  name: string
  emoji: string
  durationDays: number
  time: string
  reminderTimes: string[]
  days: string[]
}

type Completion = {
  id: string
  habitId: string
  date: string
  sessionId: string | null
  completed: boolean
}

type HabitProgressRow = Habit & {
  day: number
  doneToday: boolean
}

type Friend = {
  id: string
  name: string
  focus: string
  email: string
}

const TAB_TITLES: Record<TabKey, string> = {
  today: 'Today',
  tasks: 'Tasks',
  habits: 'Habits',
  planner: 'Planner',
  activity: 'Activity'
}

const TAB_ITEMS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'today', label: 'Today', icon: 'T' },
  { key: 'tasks', label: 'Tasks', icon: 'K' },
  { key: 'habits', label: 'Habits', icon: 'H' },
  { key: 'planner', label: 'Plan', icon: 'P' },
  { key: 'activity', label: 'Social', icon: 'S' }
]

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY_KEY_BY_NATIVE_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function getDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDisplayTime(value: string): string {
  if (!TIME_PATTERN.test(value || '')) return ''

  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function getTimestampMillis(value: unknown): number {
  if (!value) return 0

  if (typeof value === 'object' && value !== null && 'seconds' in (value as { seconds?: unknown })) {
    const cast = value as { seconds?: unknown; nanoseconds?: unknown }
    const seconds = Number(cast.seconds || 0)
    const nanos = Number(cast.nanoseconds || 0)
    return (seconds * 1000) + Math.floor(nanos / 1000000)
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'urgent') return 'urgent'
  if (normalized === 'high') return 'high'
  if (normalized === 'low') return 'low'
  return 'medium'
}

function normalizeTaskFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
  const data = snapshot.data()
  const title = String(data.title || data.name || 'Untitled task').trim()
  const dueTime = TIME_PATTERN.test(String(data.dueTime || '')) ? String(data.dueTime) : ''

  return {
    id: snapshot.id,
    title: title || 'Untitled task',
    priority: normalizeTaskPriority(data.priority),
    completed: Boolean(data.completed),
    dueDate: String(data.dueDate || ''),
    dueTime,
    createdAt: getTimestampMillis(data.createdAt)
  }
}

function sortTasks(entries: Task[]): Task[] {
  return [...entries].sort((a, b) => {
    const dueDateA = a.dueDate || '9999-12-31'
    const dueDateB = b.dueDate || '9999-12-31'
    if (dueDateA !== dueDateB) return dueDateA.localeCompare(dueDateB)

    const dueTimeA = a.dueTime || '23:59'
    const dueTimeB = b.dueTime || '23:59'
    if (dueTimeA !== dueTimeB) return dueTimeA.localeCompare(dueTimeB)

    return a.createdAt - b.createdAt
  })
}

function normalizeReminderTimes(reminderTimes: unknown, fallbackTime: unknown): string[] {
  const initial = Array.isArray(reminderTimes) && reminderTimes.length > 0
    ? reminderTimes
    : [fallbackTime]

  const valid = [...new Set(initial
    .map((value) => String(value || '').trim())
    .filter((value) => TIME_PATTERN.test(value)))]
    .sort((a, b) => a.localeCompare(b))

  return valid.length > 0 ? valid : ['09:00']
}

function normalizeHabitFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Habit {
  const data = snapshot.data()
  const days = Array.isArray(data.days) && data.days.length > 0
    ? data.days.map((day: unknown) => String(day)).filter(Boolean)
    : ['mon', 'tue', 'wed', 'thu', 'fri']
  const reminderTimes = normalizeReminderTimes(data.reminderTimes, data.time)

  return {
    id: snapshot.id,
    name: String(data.name || 'Untitled habit').trim() || 'Untitled habit',
    emoji: String(data.emoji || '✓'),
    durationDays: Number(data.durationDays) > 0 ? Number(data.durationDays) : 21,
    time: reminderTimes[0],
    reminderTimes,
    days
  }
}

function normalizeCompletionFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Completion {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    habitId: String(data.habitId || ''),
    date: String(data.date || ''),
    sessionId: data.sessionId ? String(data.sessionId) : null,
    completed: data.completed !== false
  }
}

function getHabitSessionIds(habit: Habit): string[] {
  return normalizeReminderTimes(habit.reminderTimes, habit.time)
}

function getCompletedSessionIds(sessionIds: string[], completionsForDate: Completion[]): string[] {
  const explicitSet = new Set(
    completionsForDate
      .map((completion) => completion.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
  )

  const explicitInOrder = sessionIds.filter((sessionId) => explicitSet.has(sessionId))
  const legacyCount = completionsForDate.filter((completion) => !completion.sessionId).length
  const targetCompletedCount = Math.min(sessionIds.length, explicitInOrder.length + legacyCount)
  const completed: string[] = [...explicitInOrder]

  if (completed.length >= targetCompletedCount) {
    return completed
  }

  for (const sessionId of sessionIds) {
    if (completed.includes(sessionId)) continue
    completed.push(sessionId)
    if (completed.length >= targetCompletedCount) break
  }

  return completed
}

function isHabitScheduledForDate(habit: Habit, date = new Date()): boolean {
  if (!Array.isArray(habit.days) || habit.days.length === 0) return true
  const dayKey = DAY_KEY_BY_NATIVE_INDEX[date.getDay()]
  return habit.days.includes(dayKey)
}

function isHabitDoneForDate(habit: Habit, completions: Completion[], dateKey: string): boolean {
  const sessionIds = getHabitSessionIds(habit)
  const dateCompletions = completions.filter((completion) => {
    return completion.habitId === habit.id && completion.date === dateKey && completion.completed !== false
  })
  const completedSessionIds = getCompletedSessionIds(sessionIds, dateCompletions)
  return completedSessionIds.length >= sessionIds.length
}

function getHabitCompletedDays(habitId: string, completions: Completion[]): number {
  const uniqueDates = new Set(
    completions
      .filter((completion) => completion.habitId === habitId && completion.completed !== false)
      .map((completion) => completion.date)
  )
  return uniqueDates.size
}

function getPriorityLabel(value: TaskPriority): 'Low' | 'Medium' | 'High' | 'Urgent' {
  if (value === 'urgent') return 'Urgent'
  if (value === 'high') return 'High'
  if (value === 'low') return 'Low'
  return 'Medium'
}

async function ensureUserDocument(dbClient: Firestore, user: User): Promise<UserProfile> {
  const userRef = doc(dbClient, 'users', user.uid)
  const profileSnapshot = await getDoc(userRef)

  if (!profileSnapshot.exists()) {
    const fallbackName = user.displayName || user.email?.split('@')[0] || 'Track.now User'
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: fallbackName,
      plan: 'free',
      createdAt: serverTimestamp()
    }, { merge: true })

    return {
      uid: user.uid,
      name: fallbackName,
      email: user.email || '',
      plan: 'free'
    }
  }

  const data = profileSnapshot.data()
  return {
    uid: user.uid,
    name: String(data.displayName || user.displayName || user.email || 'Track.now User'),
    email: String(data.email || user.email || ''),
    plan: String(data.plan || 'free')
  }
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [ghostMode, setGhostMode] = useState(false)

  const [quickAddVisible, setQuickAddVisible] = useState(false)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddBusy, setQuickAddBusy] = useState(false)

  const googleConfig = useMemo(() => ({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    selectAccount: true
  }), [])

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest(googleConfig)

  const requireBackend = useCallback((): { authClient: Auth; dbClient: Firestore } | null => {
    if (!hasFirebaseConfig || !auth || !db) {
      Alert.alert(
        'Firebase not configured',
        'Set EXPO_PUBLIC_FIREBASE_* variables in mobile/.env and restart Expo.'
      )
      return null
    }

    return { authClient: auth, dbClient: db }
  }, [])

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)

      if (!user || !db) {
        setProfile(null)
        setAuthReady(true)
        return
      }

      try {
        const nextProfile = await ensureUserDocument(db, user)
        setProfile(nextProfile)
      } catch (error) {
        const fallbackName = user.displayName || user.email || 'Track.now User'
        setProfile({
          uid: user.uid,
          name: fallbackName,
          email: user.email || '',
          plan: 'free'
        })
      } finally {
        setAuthReady(true)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!authUser || !db) {
      setTasks([])
      setHabits([])
      setCompletions([])
      setFriends([])
      setIsSyncing(false)
      return
    }

    const userId = authUser.uid
    const dbClient = db
    let active = true
    setIsSyncing(true)

    const readyFlags = {
      tasks: false,
      habits: false,
      completions: false,
      friends: false
    }

    const markReady = (key: keyof typeof readyFlags) => {
      if (!active) return
      if (!readyFlags[key]) {
        readyFlags[key] = true
      }
      if (Object.values(readyFlags).every(Boolean)) {
        setIsSyncing(false)
      }
    }

    const unsubscribers: Unsubscribe[] = []

    const tasksQuery = query(collection(dbClient, 'tasks'), where('userId', '==', userId))
    unsubscribers.push(onSnapshot(tasksQuery, (snapshot) => {
      if (!active) return
      setTasks(sortTasks(snapshot.docs.map((entry) => normalizeTaskFromDoc(entry))))
      markReady('tasks')
    }, () => {
      if (active) setTasks([])
      markReady('tasks')
    }))

    const habitsQuery = query(collection(dbClient, 'habits'), where('userId', '==', userId))
    unsubscribers.push(onSnapshot(habitsQuery, (snapshot) => {
      if (!active) return
      setHabits(snapshot.docs.map((entry) => normalizeHabitFromDoc(entry)))
      markReady('habits')
    }, () => {
      if (active) setHabits([])
      markReady('habits')
    }))

    const completionsQuery = query(collection(dbClient, 'completions'), where('userId', '==', userId))
    unsubscribers.push(onSnapshot(completionsQuery, (snapshot) => {
      if (!active) return
      setCompletions(snapshot.docs.map((entry) => normalizeCompletionFromDoc(entry)))
      markReady('completions')
    }, () => {
      if (active) setCompletions([])
      markReady('completions')
    }))

    const friendshipsQuery = query(
      collection(dbClient, 'friendships'),
      where('users', 'array-contains', userId),
      where('status', '==', 'accepted')
    )

    unsubscribers.push(onSnapshot(friendshipsQuery, (snapshot) => {
      void (async () => {
        try {
          const friendIds = Array.from(new Set(snapshot.docs.map((entry) => {
            const users = entry.data().users as string[] | undefined
            if (!Array.isArray(users)) return null
            return users.find((uid) => uid !== userId) || null
          }).filter((uid): uid is string => Boolean(uid))))

          if (friendIds.length === 0) {
            if (active) setFriends([])
            return
          }

          const profileSnapshots = await Promise.all(friendIds.map((friendId) => getDoc(doc(dbClient, 'users', friendId))))
          if (!active) return

          const nextFriends: Friend[] = profileSnapshots
            .filter((profileSnapshot) => profileSnapshot.exists())
            .map((profileSnapshot) => {
              const data = profileSnapshot.data()
              const displayName = String(data.displayName || data.email || 'Friend').trim()
              const plan = String(data.plan || 'free').toUpperCase()

              return {
                id: profileSnapshot.id,
                name: displayName,
                email: String(data.email || ''),
                focus: `Plan ${plan}`
              }
            })
            .sort((a, b) => a.name.localeCompare(b.name))

          setFriends(nextFriends)
        } catch {
          if (active) setFriends([])
        } finally {
          markReady('friends')
        }
      })()
    }, () => {
      if (active) setFriends([])
      markReady('friends')
    }))

    return () => {
      active = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [authUser?.uid])

  const todayDateKey = getDateKey()

  const todayCompletions = useMemo(() => {
    return completions.filter((completion) => completion.date === todayDateKey && completion.completed !== false)
  }, [completions, todayDateKey])

  const todayHabits = useMemo(() => {
    return habits.filter((habit) => isHabitScheduledForDate(habit, new Date()))
  }, [habits])

  const habitsWithProgress = useMemo(() => {
    return habits.map((habit) => {
      const completedDays = getHabitCompletedDays(habit.id, completions)
      const doneToday = isHabitDoneForDate(habit, todayCompletions, todayDateKey)

      return {
        ...habit,
        day: Math.max(1, Math.min(completedDays + 1, habit.durationDays)),
        doneToday
      }
    })
  }, [habits, completions, todayCompletions, todayDateKey])

  const doneHabits = useMemo(() => {
    return todayHabits.filter((habit) => isHabitDoneForDate(habit, todayCompletions, todayDateKey)).length
  }, [todayHabits, todayCompletions, todayDateKey])

  const missionPercent = useMemo(() => {
    if (todayHabits.length === 0) return 0
    return Math.round((doneHabits / todayHabits.length) * 100)
  }, [doneHabits, todayHabits.length])

  const openTasks = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks])

  const initials = useMemo(() => {
    const seed = String(profile?.name || authUser?.displayName || authUser?.email || 'T').trim()
    return (seed[0] || 'T').toUpperCase()
  }, [profile?.name, authUser?.displayName, authUser?.email])

  async function handleAuthSubmit() {
    const services = requireBackend()
    if (!services) return

    const email = emailInput.trim().toLowerCase()
    const password = passwordInput.trim()
    const name = nameInput.trim()

    if (authMode === 'signup' && name.length < 2) {
      Alert.alert('Name required', 'Please enter your full name.')
      return
    }

    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.')
      return
    }

    setAuthBusy(true)
    try {
      if (authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(services.authClient, email, password)
        const displayName = name || email.split('@')[0] || 'Track.now User'

        await updateProfile(credential.user, { displayName })
        await setDoc(doc(services.dbClient, 'users', credential.user.uid), {
          uid: credential.user.uid,
          email,
          displayName,
          plan: 'free',
          createdAt: serverTimestamp()
        }, { merge: true })
      } else {
        await signInWithEmailAndPassword(services.authClient, email, password)
      }

      setPasswordInput('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed'
      Alert.alert('Authentication failed', message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleGoogleLogin() {
    const services = requireBackend()
    if (!services) return

    if (!googleRequest) {
      Alert.alert(
        'Google sign-in unavailable',
        'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env.'
      )
      return
    }

    setAuthBusy(true)
    try {
      const result = await promptGoogleAsync()

      if (result.type !== 'success') {
        return
      }

      const idToken = result.params?.id_token
      if (!idToken) {
        throw new Error('Google OAuth did not return an ID token.')
      }

      const credential = GoogleAuthProvider.credential(idToken)
      const credentialResult = await signInWithCredential(services.authClient, credential)
      await ensureUserDocument(services.dbClient, credentialResult.user)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed'
      Alert.alert('Google sign-in failed', message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    if (!auth) return

    try {
      await signOut(auth)
      setActiveTab('today')
      setQuickAddVisible(false)
      setQuickAddTitle('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      Alert.alert('Sign out failed', message)
    }
  }

  async function toggleTask(taskId: string) {
    const services = requireBackend()
    if (!services) return

    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) return

    try {
      await updateDoc(doc(services.dbClient, 'tasks', taskId), {
        completed: !task.completed,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update task.'
      Alert.alert('Task update failed', message)
    }
  }

  async function toggleHabit(habitId: string) {
    const services = requireBackend()
    if (!services || !authUser) return

    const habit = habits.find((entry) => entry.id === habitId)
    if (!habit) return

    const completionsForHabitToday = todayCompletions.filter((entry) => entry.habitId === habitId)
    const doneToday = isHabitDoneForDate(habit, todayCompletions, todayDateKey)

    try {
      if (doneToday) {
        await Promise.all(
          completionsForHabitToday.map((completion) => deleteDoc(doc(services.dbClient, 'completions', completion.id)))
        )
        return
      }

      const sessionIds = getHabitSessionIds(habit)
      const completedSessionIds = getCompletedSessionIds(sessionIds, completionsForHabitToday)
      const missingSessionIds = sessionIds.filter((sessionId) => !completedSessionIds.includes(sessionId))

      const sessionsToCreate = missingSessionIds.length > 0 ? missingSessionIds : [null]

      await Promise.all(
        sessionsToCreate.map((sessionId) => addDoc(collection(services.dbClient, 'completions'), {
          habitId,
          userId: authUser.uid,
          date: todayDateKey,
          sessionId,
          completed: true,
          completedAt: serverTimestamp()
        }))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update habit.'
      Alert.alert('Habit update failed', message)
    }
  }

  function handleQuickAdd() {
    if (!authUser) return
    setQuickAddTitle('')
    setQuickAddVisible(true)
  }

  async function submitQuickAdd() {
    const services = requireBackend()
    if (!services || !authUser) return

    const title = quickAddTitle.trim()
    if (title.length < 2) {
      Alert.alert('Task title required', 'Please enter at least 2 characters.')
      return
    }

    setQuickAddBusy(true)
    try {
      await addDoc(collection(services.dbClient, 'tasks'), {
        userId: authUser.uid,
        title,
        notes: '',
        category: 'general',
        priority: 'medium',
        dueDate: '',
        dueTime: '',
        completed: false,
        source: 'manual',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      setQuickAddVisible(false)
      setQuickAddTitle('')
      setActiveTab('tasks')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add task.'
      Alert.alert('Quick add failed', message)
    } finally {
      setQuickAddBusy(false)
    }
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <BackgroundAtmosphere />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#ffffff" size="large" />
          <Text style={styles.loadingText}>Connecting to Track.now...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!authUser) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <BackgroundAtmosphere />

        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authWrap}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandLabel}>Track.now</Text>
            </View>

            <Text style={styles.authHeadline}>Consistency is the only secret.</Text>
            <Text style={styles.authSubhead}>
              Mission-based tracking with calm accountability and clear daily actions.
            </Text>

            {!hasFirebaseConfig && (
              <Text style={styles.configWarning}>
                Firebase config is missing. Add EXPO_PUBLIC_FIREBASE_* values to mobile/.env and restart Expo.
              </Text>
            )}

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, authMode === 'signin' && styles.modeButtonActive]}
                onPress={() => setAuthMode('signin')}
                disabled={authBusy}
              >
                <Text style={[styles.modeButtonText, authMode === 'signin' && styles.modeButtonTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, authMode === 'signup' && styles.modeButtonActive]}
                onPress={() => setAuthMode('signup')}
                disabled={authBusy}
              >
                <Text style={[styles.modeButtonText, authMode === 'signup' && styles.modeButtonTextActive]}>Create account</Text>
              </Pressable>
            </View>

            {authMode === 'signup' && (
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Full name"
                placeholderTextColor="#737378"
                style={styles.input}
                editable={!authBusy}
              />
            )}

            <TextInput
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor="#737378"
              style={styles.input}
              editable={!authBusy}
            />

            <TextInput
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#737378"
              style={styles.input}
              editable={!authBusy}
            />

            <Pressable style={[styles.primaryButton, authBusy && styles.disabledButton]} onPress={handleAuthSubmit} disabled={authBusy}>
              <Text style={styles.primaryButtonText}>
                {authBusy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, (authBusy || !googleRequest) && styles.disabledButton]}
              onPress={handleGoogleLogin}
              disabled={authBusy || !googleRequest}
            >
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>

            {Platform.OS !== 'web' && !googleRequest && (
              <Text style={styles.googleHint}>
                Google sign-in will activate after OAuth client IDs are set in mobile/.env.
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <BackgroundAtmosphere />

      <TopBar title={TAB_TITLES[activeTab]} initials={initials} onSignOut={handleSignOut} />

      {isSyncing && (
        <View style={styles.syncBanner}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.syncBannerText}>Syncing from Firebase...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.screenScroll}>
        {activeTab === 'today' && (
          <TodayScreen
            missionPercent={missionPercent}
            doneHabits={doneHabits}
            totalHabits={todayHabits.length}
            openTasks={openTasks}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksScreen tasks={tasks} onToggleTask={toggleTask} />
        )}

        {activeTab === 'habits' && (
          <HabitsScreen habits={habitsWithProgress} onToggleHabit={toggleHabit} />
        )}

        {activeTab === 'planner' && (
          <PlannerScreen tasks={tasks} habits={habitsWithProgress} />
        )}

        {activeTab === 'activity' && (
          <ActivityScreen
            friends={friends}
            ghostMode={ghostMode}
            onToggleGhost={() => setGhostMode((value) => !value)}
          />
        )}
      </ScrollView>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} onQuickAdd={handleQuickAdd} />

      <Modal visible={quickAddVisible} transparent animationType="fade" onRequestClose={() => setQuickAddVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.quickAddCard}>
            <Text style={styles.quickAddTitle}>Quick Add Task</Text>
            <TextInput
              value={quickAddTitle}
              onChangeText={setQuickAddTitle}
              placeholder="What needs to be done?"
              placeholderTextColor="#737378"
              style={styles.input}
              editable={!quickAddBusy}
              autoFocus
            />

            <View style={styles.quickAddActions}>
              <Pressable
                style={[styles.ghostAction, quickAddBusy && styles.disabledButton]}
                onPress={() => setQuickAddVisible(false)}
                disabled={quickAddBusy}
              >
                <Text style={styles.ghostActionText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryButton, quickAddBusy && styles.disabledButton, styles.quickAddPrimary]}
                onPress={submitQuickAdd}
                disabled={quickAddBusy}
              >
                <Text style={styles.primaryButtonText}>{quickAddBusy ? 'Saving...' : 'Save Task'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function BackgroundAtmosphere() {
  return (
    <View pointerEvents="none" style={styles.bgLayer}>
      <View style={[styles.bgOrb, styles.bgOrbA]} />
      <View style={[styles.bgOrb, styles.bgOrbB]} />
    </View>
  )
}

function TopBar({ title, initials, onSignOut }: { title: string; initials: string; onSignOut: () => void }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBrandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.topBrandText}>Track.now</Text>
      </View>

      <Text style={styles.topTitle}>{title}</Text>

      <View style={styles.topActions}>
        <View style={styles.avatarChip}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Pressable style={styles.iconGhostButton} onPress={onSignOut}>
          <Text style={styles.iconGhostButtonText}>Exit</Text>
        </Pressable>
      </View>
    </View>
  )
}

function BottomNav({ activeTab, onChangeTab, onQuickAdd }: { activeTab: TabKey; onChangeTab: (key: TabKey) => void; onQuickAdd: () => void }) {
  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        {TAB_ITEMS.slice(0, 2).map((item) => (
          <Pressable key={item.key} style={styles.navItem} onPress={() => onChangeTab(item.key)}>
            <Text style={[styles.navIcon, activeTab === item.key && styles.navIconActive]}>{item.icon}</Text>
            <Text style={[styles.navLabel, activeTab === item.key && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}

        <Pressable style={styles.centerButton} onPress={onQuickAdd}>
          <Text style={styles.centerButtonText}>+</Text>
        </Pressable>

        {TAB_ITEMS.slice(2).map((item) => (
          <Pressable key={item.key} style={styles.navItem} onPress={() => onChangeTab(item.key)}>
            <Text style={[styles.navIcon, activeTab === item.key && styles.navIconActive]}>{item.icon}</Text>
            <Text style={[styles.navLabel, activeTab === item.key && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function TodayScreen({ missionPercent, doneHabits, totalHabits, openTasks }: { missionPercent: number; doneHabits: number; totalHabits: number; openTasks: number }) {
  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.ringOuter}>
          <View style={styles.ringInner}>
            <Text style={styles.ringPercent}>{missionPercent}%</Text>
            <Text style={styles.ringLabel}>Day 14 / 21</Text>
          </View>
        </View>

        <Text style={styles.heroLine}>You are building a disciplined identity one mission at a time.</Text>
      </View>

      <View style={styles.gridTwo}>
        <CardStat label="Habits Done" value={`${doneHabits}/${totalHabits}`} />
        <CardStat label="Open Tasks" value={String(openTasks)} />
      </View>
    </View>
  )
}

function TasksScreen({ tasks, onToggleTask }: { tasks: Task[]; onToggleTask: (taskId: string) => void }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Task Stack</Text>

      {tasks.length === 0 && (
        <Text style={styles.emptyHint}>No tasks yet. Use the center + button to add one.</Text>
      )}

      {tasks.map((task) => (
        <Pressable key={task.id} style={styles.rowCard} onPress={() => onToggleTask(task.id)}>
          <View style={[styles.checkDot, task.completed && styles.checkDotActive]} />
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, task.completed && styles.rowTitleDone]}>{task.title}</Text>
            <Text style={styles.rowMeta}>
              {getPriorityLabel(task.priority)} Priority
              {task.dueDate ? ` - ${task.dueDate}${task.dueTime ? ` ${toDisplayTime(task.dueTime)}` : ''}` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function HabitsScreen({ habits, onToggleHabit }: { habits: HabitProgressRow[]; onToggleHabit: (habitId: string) => void }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Mission Command</Text>

      {habits.length === 0 && (
        <Text style={styles.emptyHint}>No habits found in Firestore for this account yet.</Text>
      )}

      {habits.map((habit) => {
        const progress = Math.max(0, Math.min(Math.round((habit.day / habit.durationDays) * 100), 100))
        return (
          <Pressable key={habit.id} style={styles.habitCard} onPress={() => onToggleHabit(habit.id)}>
            <View style={styles.habitHead}>
              <Text style={styles.rowTitle}>{habit.name}</Text>
              <Text style={styles.rowMeta}>Day {habit.day}/{habit.durationDays}</Text>
            </View>
            <View style={styles.trackBar}>
              <View style={[styles.trackFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.rowMeta}>{habit.doneToday ? 'Completed today' : 'Tap to mark complete'}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function PlannerScreen({ tasks, habits }: { tasks: Task[]; habits: HabitProgressRow[] }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Planner Horizon</Text>
      <Text style={styles.rowMeta}>Morning</Text>
      <Text style={styles.rowTitle}>Focused study mission</Text>

      <Text style={[styles.rowMeta, styles.spacedMeta]}>Afternoon</Text>
      <Text style={styles.rowTitle}>{tasks[0]?.title || 'Deep work sprint'}</Text>

      <Text style={[styles.rowMeta, styles.spacedMeta]}>Evening</Text>
      <Text style={styles.rowTitle}>{habits[0]?.name || 'Morning run'} review</Text>
    </View>
  )
}

function ActivityScreen({ friends, ghostMode, onToggleGhost }: { friends: Friend[]; ghostMode: boolean; onToggleGhost: () => void }) {
  return (
    <View>
      <View style={styles.sectionCard}>
        <View style={styles.activityHead}>
          <Text style={styles.sectionTitle}>Community Pulse</Text>
          <Pressable style={[styles.ghostToggle, ghostMode && styles.ghostToggleActive]} onPress={onToggleGhost}>
            <Text style={[styles.ghostToggleText, ghostMode && styles.ghostToggleTextActive]}>{ghostMode ? 'Ghost ON' : 'Ghost OFF'}</Text>
          </Pressable>
        </View>

        <View style={styles.mapBox}>
          <View style={[styles.mapPin, { top: 30, left: 80 }]} />
          <View style={[styles.mapPin, { top: 92, left: 166 }]} />
          <View style={[styles.mapPin, { top: 58, left: 252 }]} />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Nearby Comrades</Text>

        {friends.length === 0 && (
          <Text style={styles.emptyHint}>No accepted friendships yet. Add friends from the web app to see them here.</Text>
        )}

        {friends.map((friend) => (
          <View key={friend.id} style={styles.rowCard}>
            <View style={styles.friendAvatar}>
              <Text style={styles.avatarText}>{friend.name.charAt(0)}</Text>
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{friend.name}</Text>
              <Text style={styles.rowMeta}>{friend.focus}</Text>
            </View>
            <Pressable style={styles.nudgeButton} onPress={() => Alert.alert('Nudge sent', `Fire nudge sent to ${friend.name}.`)}>
              <Text style={styles.nudgeButtonText}>Nudge</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000'
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  loadingText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '600'
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject
  },
  bgOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 0.18,
    backgroundColor: '#ffffff'
  },
  bgOrbA: {
    top: -110,
    left: -80
  },
  bgOrbB: {
    bottom: -120,
    right: -110,
    opacity: 0.12
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  authWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(12,12,12,0.95)',
    borderRadius: 24,
    padding: 20
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  brandDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: '#fff'
  },
  brandLabel: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    textTransform: 'uppercase'
  },
  authHeadline: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8
  },
  authSubhead: {
    color: '#a5a5aa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18
  },
  configWarning: {
    color: '#f2ba70',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden'
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#121212'
  },
  modeButtonActive: {
    backgroundColor: '#fff'
  },
  modeButtonText: {
    color: '#a0a0a6',
    fontWeight: '700'
  },
  modeButtonTextActive: {
    color: '#000'
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    backgroundColor: '#111',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 13
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '800'
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: '#e5e5e5',
    fontWeight: '700'
  },
  disabledButton: {
    opacity: 0.6
  },
  googleHint: {
    marginTop: 8,
    color: '#8f8f95',
    fontSize: 12,
    lineHeight: 16
  },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  topBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 110
  },
  topBrandText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase'
  },
  topTitle: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontSize: 12
  },
  topActions: {
    width: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8
  },
  avatarChip: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  iconGhostButton: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)'
  },
  iconGhostButtonText: {
    color: '#d8d8d8',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase'
  },
  screenScroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 108,
    gap: 12
  },
  syncBanner: {
    marginTop: 8,
    marginHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,18,0.92)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  syncBannerText: {
    color: '#d8d8dd',
    fontSize: 12,
    fontWeight: '600'
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#121212',
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 14,
    marginBottom: 10
  },
  ringOuter: {
    width: 170,
    height: 170,
    borderRadius: 999,
    borderWidth: 7,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  ringInner: {
    width: 132,
    height: 132,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ringPercent: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900'
  },
  ringLabel: {
    color: '#ababaf',
    fontSize: 12,
    marginTop: 2
  },
  heroLine: {
    color: '#b7b7bc',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20
  },
  gridTwo: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111',
    padding: 14
  },
  statLabel: {
    color: '#a1a1a6',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  statValue: {
    color: '#fff',
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800'
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111',
    padding: 14,
    marginBottom: 10
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10
  },
  emptyHint: {
    color: '#a1a1a6',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10
  },
  rowCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#151515',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7a7a7f'
  },
  checkDotActive: {
    backgroundColor: '#fff',
    borderColor: '#fff'
  },
  rowCopy: {
    flex: 1
  },
  rowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },
  rowTitleDone: {
    color: '#7f7f84',
    textDecorationLine: 'line-through'
  },
  rowMeta: {
    color: '#97979c',
    marginTop: 2,
    fontSize: 12
  },
  habitCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#151515',
    padding: 12,
    marginBottom: 10
  },
  habitHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  trackBar: {
    borderRadius: 999,
    height: 7,
    backgroundColor: '#262626',
    overflow: 'hidden'
  },
  trackFill: {
    height: 7,
    backgroundColor: '#ffffff'
  },
  spacedMeta: {
    marginTop: 12
  },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  ghostToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  ghostToggleActive: {
    backgroundColor: '#fff'
  },
  ghostToggleText: {
    color: '#f0f0f0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  ghostToggleTextActive: {
    color: '#000'
  },
  mapBox: {
    marginTop: 10,
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#151515'
  },
  mapPin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#fff'
  },
  friendAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#1e1e1e'
  },
  nudgeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  nudgeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 10,
    paddingHorizontal: 12
  },
  bottomNav: {
    minHeight: 76,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(11,11,11,0.9)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  navItem: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2
  },
  navIcon: {
    color: '#6e6e72',
    fontWeight: '700',
    fontSize: 16
  },
  navIconActive: {
    color: '#fff'
  },
  navLabel: {
    color: '#6e6e72',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  navLabelActive: {
    color: '#fff'
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: -22
  },
  centerButtonText: {
    color: '#000',
    fontSize: 28,
    fontWeight: '800',
    marginTop: -2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  quickAddCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#111',
    padding: 16
  },
  quickAddTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10
  },
  quickAddActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center'
  },
  ghostAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ghostActionText: {
    color: '#d8d8dc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  quickAddPrimary: {
    marginTop: 0,
    minWidth: 120
  }
})

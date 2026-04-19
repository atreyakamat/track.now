import { StatusBar } from 'expo-status-bar'
import React, { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'

type AuthMode = 'signin' | 'signup'
type TabKey = 'today' | 'tasks' | 'habits' | 'planner' | 'activity'

type UserProfile = {
  name: string
  email: string
}

type Task = {
  id: string
  title: string
  priority: 'High' | 'Medium' | 'Low'
  done: boolean
}

type Habit = {
  id: string
  name: string
  day: number
  totalDays: number
  doneToday: boolean
}

type Friend = {
  id: string
  name: string
  focus: string
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

const INITIAL_TASKS: Task[] = [
  { id: 't1', title: 'Deep work sprint', priority: 'High', done: false },
  { id: 't2', title: 'Call with mentor', priority: 'Medium', done: false },
  { id: 't3', title: 'Read 20 pages', priority: 'Low', done: true }
]

const INITIAL_HABITS: Habit[] = [
  { id: 'h1', name: 'Morning run', day: 14, totalDays: 21, doneToday: true },
  { id: 'h2', name: 'Focused study', day: 8, totalDays: 21, doneToday: false },
  { id: 'h3', name: 'No sugar', day: 31, totalDays: 45, doneToday: false }
]

const INITIAL_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Erik X.', focus: 'Morning Run 80%' },
  { id: 'f2', name: 'Sarah L.', focus: 'Deep Work 45m' },
  { id: 'f3', name: 'Marcus K.', focus: 'Fasting 14h' },
  { id: 'f4', name: 'Jade N.', focus: 'Reading 12p' }
]

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS)
  const [ghostMode, setGhostMode] = useState(false)

  const doneHabits = useMemo(() => habits.filter((habit) => habit.doneToday).length, [habits])
  const missionPercent = useMemo(() => {
    if (habits.length === 0) return 0
    return Math.round((doneHabits / habits.length) * 100)
  }, [doneHabits, habits.length])
  const openTasks = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])

  function handleAuthSubmit() {
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

    setProfile({
      name: authMode === 'signup' ? name : 'Track.now User',
      email
    })
  }

  function handleSignOut() {
    setProfile(null)
    setPasswordInput('')
    setActiveTab('today')
  }

  function toggleTask(taskId: string) {
    setTasks((previous) => previous.map((task) => {
      if (task.id !== taskId) return task
      return { ...task, done: !task.done }
    }))
  }

  function toggleHabit(habitId: string) {
    setHabits((previous) => previous.map((habit) => {
      if (habit.id !== habitId) return habit
      return { ...habit, doneToday: !habit.doneToday }
    }))
  }

  function handleQuickAdd() {
    Alert.alert('Quick add', 'Connect this action to your backend create flow.')
  }

  if (!profile) {
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

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, authMode === 'signin' && styles.modeButtonActive]}
                onPress={() => setAuthMode('signin')}
              >
                <Text style={[styles.modeButtonText, authMode === 'signin' && styles.modeButtonTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, authMode === 'signup' && styles.modeButtonActive]}
                onPress={() => setAuthMode('signup')}
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
            />

            <TextInput
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#737378"
              style={styles.input}
            />

            <Pressable style={styles.primaryButton} onPress={handleAuthSubmit}>
              <Text style={styles.primaryButtonText}>
                {authMode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => Alert.alert('Google auth', 'Connect Firebase Google auth here.') }>
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const initials = profile.name.trim().charAt(0).toUpperCase() || 'T'

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <BackgroundAtmosphere />

      <TopBar title={TAB_TITLES[activeTab]} initials={initials} onSignOut={handleSignOut} />

      <ScrollView contentContainerStyle={styles.screenScroll}>
        {activeTab === 'today' && (
          <TodayScreen
            missionPercent={missionPercent}
            doneHabits={doneHabits}
            totalHabits={habits.length}
            openTasks={openTasks}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksScreen tasks={tasks} onToggleTask={toggleTask} />
        )}

        {activeTab === 'habits' && (
          <HabitsScreen habits={habits} onToggleHabit={toggleHabit} />
        )}

        {activeTab === 'planner' && (
          <PlannerScreen tasks={tasks} habits={habits} />
        )}

        {activeTab === 'activity' && (
          <ActivityScreen friends={INITIAL_FRIENDS} ghostMode={ghostMode} onToggleGhost={() => setGhostMode((value) => !value)} />
        )}
      </ScrollView>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} onQuickAdd={handleQuickAdd} />
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
      {tasks.map((task) => (
        <Pressable key={task.id} style={styles.rowCard} onPress={() => onToggleTask(task.id)}>
          <View style={[styles.checkDot, task.done && styles.checkDotActive]} />
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, task.done && styles.rowTitleDone]}>{task.title}</Text>
            <Text style={styles.rowMeta}>{task.priority} Priority</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function HabitsScreen({ habits, onToggleHabit }: { habits: Habit[]; onToggleHabit: (habitId: string) => void }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Mission Command</Text>
      {habits.map((habit) => {
        const progress = Math.max(0, Math.min(Math.round((habit.day / habit.totalDays) * 100), 100))
        return (
          <Pressable key={habit.id} style={styles.habitCard} onPress={() => onToggleHabit(habit.id)}>
            <View style={styles.habitHead}>
              <Text style={styles.rowTitle}>{habit.name}</Text>
              <Text style={styles.rowMeta}>Day {habit.day}/{habit.totalDays}</Text>
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

function PlannerScreen({ tasks, habits }: { tasks: Task[]; habits: Habit[] }) {
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
  }
})

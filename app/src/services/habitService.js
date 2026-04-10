import {
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { isHabitScheduledForDate, normalizeHabit } from 'src/utils/habitModel'

export const habitService = {
  async getHabits(userId) {
    const q = query(
      collection(db, 'habits'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async createHabit(userId, data) {
    return await addDoc(collection(db, 'habits'), normalizeHabit({
      ...data,
      userId,
      streak: 0,
      lastCompleted: null,
      createdAt: serverTimestamp()
    }))
  },

  async updateHabit(id, data) {
    return await updateDoc(doc(db, 'habits', id), normalizeHabit(data))
  },

  async deleteHabit(id) {
    return await deleteDoc(doc(db, 'habits', id))
  },

  getTodayHabits(habits) {
    return habits
      .map((habit) => normalizeHabit(habit))
      .filter((habit) => isHabitScheduledForDate(habit))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }
}

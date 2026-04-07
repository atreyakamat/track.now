import {
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'

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
    return await addDoc(collection(db, 'habits'), {
      ...data,
      userId,
      streak: 0,
      lastCompleted: null,
      createdAt: serverTimestamp()
    })
  },

  async updateHabit(id, data) {
    return await updateDoc(doc(db, 'habits', id), data)
  },

  async deleteHabit(id) {
    return await deleteDoc(doc(db, 'habits', id))
  },

  getTodayHabits(habits) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const today = days[new Date().getDay()]
    return habits.filter(h => h.days?.includes(today))
  }
}

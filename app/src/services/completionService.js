import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { getDateKey } from 'src/utils/habitModel'

export const completionService = {
  async getCompletions(userId, startDate, endDate) {
    const q = query(
      collection(db, 'completions'),
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getTodayCompletions(userId) {
    const today = getDateKey()
    return this.getCompletions(userId, today, today)
  },

  async markComplete(userId, habitId) {
    const today = getDateKey()
    return await addDoc(collection(db, 'completions'), {
      habitId,
      userId,
      date: today,
      completed: true,
      completedAt: serverTimestamp()
    })
  },

  async unmarkComplete(completionId) {
    return await deleteDoc(doc(db, 'completions', completionId))
  },

  buildHeatmapData(completions) {
    const map = {}
    completions.forEach(c => {
      map[c.date] = (map[c.date] || 0) + 1
    })
    return map
  }
}

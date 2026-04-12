import {
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'

export const taskService = {
  async getTasks(userId) {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async createTask(userId, data) {
    return await addDoc(collection(db, 'tasks'), {
      ...data,
      userId,
      completed: false,
      createdAt: serverTimestamp()
    })
  },

  async updateTask(id, data) {
    return await updateDoc(doc(db, 'tasks', id), data)
  },

  async deleteTask(id) {
    return await deleteDoc(doc(db, 'tasks', id))
  }
}

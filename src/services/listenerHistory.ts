import { cloudConfigured, saveCloudChat, getCloudChats } from './cloudStorage'
export interface ListenerChat {
  id: string
  userId: string
  username: string
  comment: string
  timestamp: number
  profilePictureUrl?: string
}
let database: Promise<IDBDatabase> | undefined
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fortune-listener-history', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('messages', { keyPath: 'key' })
      store.createIndex('userId', 'userId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = undefined; reject(request.error) }
  })
}
export async function saveListenerChat(message: ListenerChat) {
  if (cloudConfigured()) return saveCloudChat(message)
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('messages', 'readwrite')
    transaction.objectStore('messages').put({ ...message, key: `${message.userId}:${message.id}` })
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}
export async function getListenerChats(userId: string): Promise<ListenerChat[]> {
  if (cloudConfigured()) return getCloudChats(userId)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('messages').objectStore('messages').index('userId').getAll(userId)
    request.onsuccess = () => resolve((request.result as ListenerChat[]).sort((a, b) => a.timestamp - b.timestamp))
    request.onerror = () => reject(request.error)
  })
}

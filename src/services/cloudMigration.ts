import { mergeListener } from './listenerBackup'
import { getLocalListenerChats } from './listenerHistory'
import { loadCloudUsers, saveCloudUser, saveCloudChats, cloudOwnerId } from './cloudStorage'
import type { RegularUser } from './listenerTypes'

// Re-running after a partial upload is safe. Never delete the browser's original copy.
export async function migrateBrowserListeners(progress: (message: string) => void = () => {}) {
  const owner = await cloudOwnerId()
  const marker = `fortune_cloud_migrated_v1:${owner}`
  if (localStorage.getItem(marker) === 'complete') return loadCloudUsers()
  const saved = localStorage.getItem('star_campe_regulars')
  const local: Record<string, RegularUser> = saved ? JSON.parse(saved) : {}
  const remote = await loadCloudUsers()
  let count = 0
  for (const [id, user] of Object.entries(local)) {
    if (!user || user.userId !== id || !Array.isArray(user.history)) throw new Error('旧ブラウザーデータの形式を確認してください。')
    progress(`既存データを移行中 ${++count}/${Object.keys(local).length}人`)
    const merged = mergeListener(remote[id], user)
    await saveCloudUser(merged)
    await saveCloudChats(await getLocalListenerChats(id))
  }
  localStorage.setItem(marker, 'complete')
  return loadCloudUsers()
}

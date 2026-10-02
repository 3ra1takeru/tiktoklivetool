import { rebaseCloudProfile } from './cloudProfile'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RegularUser } from './listenerTypes'
import type { ListenerChat } from './listenerHistory'

let client: SupabaseClient | undefined
const snapshots = new Map<string, { profile: RegularUser, revision: number }>()
let writeChain: Promise<unknown> = Promise.resolve()
export function cloudSettings() {
  return {
    url: import.meta.env?.VITE_SUPABASE_URL || (typeof localStorage !== 'undefined' ? localStorage.getItem('fortune_supabase_url') : '') || '',
    key: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('fortune_supabase_key') : '') || ''
  }
}
export function cloudConfigured() {
  const { url, key } = cloudSettings()
  return !!(url && key)
}
export function configureCloud(url: string, key: string) {
  key = key.trim()
  const parsed = new URL(url)
  if (import.meta.env?.VITE_SUPABASE_URL && (parsed.origin !== import.meta.env.VITE_SUPABASE_URL || key !== import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)) throw new Error('公開サイトの接続先は運営者が設定しています。現在の設定を使用してください。')
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) throw new Error('SupabaseのProject URLを入力してください。')
  if (!key.trim() || key.startsWith('sb_secret_')) throw new Error('Publishable keyを入力してください。シークレットキーは使用できません。')
  if (key.startsWith('ey')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') throw new Error('secret') }
    catch { throw new Error('有効なPublishable key / anon keyを入力してください。') }
  }
  localStorage.setItem('fortune_supabase_url', parsed.origin)
  localStorage.setItem('fortune_supabase_key', key.trim())
  client = undefined
  snapshots.clear()
}
export function cloudClient() {
  if (!cloudConfigured()) throw new Error('クラウド保存の初期設定が必要です。')
  const { url, key } = cloudSettings()
  return client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: async (input, init) => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (init?.signal?.aborted) abort()
    else init?.signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    try { return await fetch(input, { ...init, signal: controller.signal }) }
    finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', abort) }
  } } })
}
async function ownerId(target = cloudClient()) {
  const { data, error } = await target.auth.getSession()
  if (error || !data.session?.user) throw new Error('クラウド保存にログインしてください。')
  return data.session.user.id
}
export async function loadCloudUsers(): Promise<Record<string, RegularUser>> {
  const owner = await ownerId()
  const users: Record<string, RegularUser> = {}
  snapshots.clear()
  for (let start = 0; ; start += 1000) {
    const { data, error } = await cloudClient().from('listeners').select('tiktok_id,profile,revision').eq('owner_id', owner).order('tiktok_id').range(start, start + 999)
    if (error) throw error
    for (const row of data || []) { users[row.tiktok_id] = row.profile; snapshots.set(row.tiktok_id, { profile: structuredClone(row.profile), revision: row.revision }) }
    if (!data || data.length < 1000) break
  }
  return users
}
export function saveCloudUser(input: RegularUser): Promise<void> {
  const user = structuredClone(input)
  const target = cloudClient()
  const pending = writeChain.then(async () => {
    const owner = await ownerId(target)
    const before = snapshots.get(user.userId)
    const keys = Object.keys(user) as (keyof RegularUser)[]
    const patch = Object.fromEntries(keys.filter(key => JSON.stringify(before?.profile[key]) !== JSON.stringify(user[key])).map(key => [key, user[key]]))
    if (before && !Object.keys(patch).length) return
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: current, error: readError } = await target.from('listeners').select('profile,revision').eq('owner_id', owner).eq('tiktok_id', user.userId).maybeSingle()
      if (readError) throw readError
      const next = rebaseCloudProfile(current?.profile, before?.profile, user)
      if (current) {
        const { data, error } = await target.from('listeners').update({ profile: next, revision: current.revision + 1, updated_at: new Date().toISOString() }).eq('owner_id', owner).eq('tiktok_id', user.userId).eq('revision', current.revision).select('revision')
        if (error) throw error
        if (data?.length) { snapshots.set(user.userId, { profile: structuredClone(user), revision: current.revision + 1 }); return }
      } else {
        const { error } = await target.from('listeners').insert({ owner_id: owner, tiktok_id: user.userId, profile: next })
        if (!error) { snapshots.set(user.userId, { profile: structuredClone(user), revision: 1 }); return }
        if (error.code !== '23505') throw error
      }
    }
    throw new Error('別の端末で更新されました。再読み込みしてから保存してください。')
  })
  writeChain = pending.catch(() => {})
  return pending
}
export async function saveCloudChat(message: ListenerChat) {
  const target = cloudClient()
  const owner = await ownerId(target)
  // Ensure a profile exists before storing the comment; preserves registered profile fields.
  const { error: profileError } = await target.from('listeners').upsert({ owner_id: owner, tiktok_id: message.userId, profile: { userId: message.userId, username: message.username, birthdate: '', birthdates: [], history: [], totalDiamonds: 0, totalPayPay: 0 } }, { onConflict: 'owner_id,tiktok_id', ignoreDuplicates: true })
  if (profileError) throw profileError
  const { error } = await target.from('listener_chats').upsert({ owner_id: owner, tiktok_id: message.userId, message_id: message.id, message, sent_at: message.timestamp }, { onConflict: 'owner_id,tiktok_id,message_id', ignoreDuplicates: true })
  if (error) throw error
}
export async function getCloudChats(userId: string): Promise<ListenerChat[]> {
  const target = cloudClient()
  const owner = await ownerId(target)
  const chats: ListenerChat[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await target.from('listener_chats').select('message').eq('owner_id', owner).eq('tiktok_id', userId).order('sent_at').order('message_id').range(start, start + 999)
    if (error) throw error
    chats.push(...(data || []).map(row => row.message as ListenerChat))
    if (!data || data.length < 1000) break
  }
  return chats
}

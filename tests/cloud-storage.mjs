import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) }
const owner = '11111111-1111-4111-8111-111111111111'
let profile = { userId: 'listener', username: 'Original', birthdate: '1990年1月1日', birthdates: [], history: [], totalDiamonds: 0, totalPayPay: 0 }
let revision = 1
let unavailable = false
const chats = new Map()
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  if (url.pathname === '/auth/v1/user') return respond({ id: owner, email: 'test@example.com', aud: 'authenticated' })
  if (url.pathname === '/auth/v1/logout') return respond({})
  if (unavailable) return respond({ message: 'Database unavailable' }, 503)
  if (url.pathname === '/rest/v1/listeners') {
    if (options.method === 'PATCH') {
      const payload = JSON.parse(options.body)
      if (url.searchParams.get('revision') !== `eq.${revision}`) return respond([])
      profile = payload.profile; revision = payload.revision
      return respond([{ revision }])
    }
    if (options.method === 'POST') return respond(null, 201)
    const row = { tiktok_id: 'listener', profile, revision }
    return respond(options.headers?.Accept?.includes('object') ? row : url.searchParams.has('tiktok_id') ? row : [row])
  }
  if (url.pathname === '/rest/v1/listener_chats') {
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body)
      chats.set(payload.message_id, payload.message)
      return respond(null, 201)
    }
    return respond([...chats.values()].map(message => ({ message })))
  }
  throw new Error(`Unexpected API ${url.pathname}`)
}
const { configureCloud, cloudClient, loadCloudUsers, saveCloudUser, saveCloudChat, getCloudChats } = await import('../src/services/cloudStorage.ts')
assert.throws(() => configureCloud('https://test.supabase.co', 'sb_secret_private'))
configureCloud('https://test.supabase.co', 'sb_publishable_test')
const payload = Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
await cloudClient().auth.setSession({ access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: 'test' })
const users = await loadCloudUsers()
assert.equal(users.listener.username, 'Original')
// Another device edits a birthday after this device loads its snapshot.
profile = { ...profile, birthdate: '1992年2月2日' }
await saveCloudUser({ ...users.listener, username: 'Edited' })
assert.equal(profile.username, 'Edited')
assert.equal(profile.birthdate, '1992年2月2日', 'unrelated remote edits survive')
const message = { id: '1', userId: 'listener', username: 'Edited', comment: 'hello', timestamp: 1 }
await saveCloudChat(message)
await saveCloudChat(message)
assert.equal((await getCloudChats('listener')).length, 1)
unavailable = true
await assert.rejects(saveCloudChat({ ...message, id: '2' }))
assert.equal(localStorage.getItem('star_campe_regulars'), null, 'cloud data is never written to localStorage')
assert.equal(chats.size, 1)
await cloudClient().auth.signOut()
await assert.rejects(getCloudChats('listener'), /ログイン/)
console.log('Cloud client passed: authenticated save/load, unrelated remote edit preservation, chat deduplication, failed-write rejection, no listener localStorage writes.')

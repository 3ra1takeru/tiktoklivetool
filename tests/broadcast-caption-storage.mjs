import assert from 'node:assert/strict'
const memory=new Map()
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}
const owner='11111111-1111-4111-8111-111111111111'
const rows=new Map();let unavailable=false
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})
globalThis.fetch=async(input,init={})=>{
 const u=new URL(typeof input==='string'?input:input.url)
 if(u.pathname==='/auth/v1/user')return respond({id:owner,email:'test@example.com'})
 if(u.pathname==='/auth/v1/logout')return respond({})
 assert.equal(u.pathname,'/rest/v1/broadcast_captions')
 if(unavailable)return respond({message:'unavailable'},503)
 if(init.method==='POST'){
  const row=JSON.parse(init.body);assert.equal(row.owner_id,owner)
  const key=`${row.owner_id}:${row.room_id}:${row.caption_id}`
  if(!rows.has(key))rows.set(key,row)
  return respond(null,201)
 }
 assert.equal(u.searchParams.get('owner_id'),`eq.${owner}`)
 return respond([...rows.values()].filter(r=>!u.searchParams.has('broadcaster')||u.searchParams.get('broadcaster')===`eq.${r.broadcaster}`))
}
const {configureCloud,cloudClient}=await import('../src/services/cloudStorage.ts')
const {saveBroadcastCaption,getBroadcastCaptions}=await import('../src/services/broadcastCaptions.ts')
configureCloud('https://test.supabase.co','sb_publishable_test')
const payload=Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
await cloudClient().auth.setSession({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`,refresh_token:'test'})
const caption={id:'sentence:ja',broadcaster:'host',roomId:'room1',text:'test caption',language:'ja',sourceTimestampMs:'10',capturedAt:100,source:'tiktok_caption'}
await saveBroadcastCaption(caption,owner);await saveBroadcastCaption({...caption,capturedAt:200},owner)
assert.equal(rows.size,1)
assert.deepEqual(await getBroadcastCaptions('@host'),[caption])
await saveBroadcastCaption({...caption,roomId:'room2'},owner)
assert.equal(rows.size,2,'A different broadcast must not be removed as a duplicate')
await assert.rejects(saveBroadcastCaption(caption,'another-owner'),/アカウント/)
unavailable=true;await assert.rejects(saveBroadcastCaption({...caption,id:'new'},owner))
assert.equal(localStorage.getItem('broadcast_captions'),null)
await cloudClient().auth.signOut();await assert.rejects(getBroadcastCaptions('host'),/ログイン/)
console.log('PASS: authenticated storage, replay dedup, different rooms, retry-owner isolation, failed writes, logged-out rejection, no browser transcript storage')

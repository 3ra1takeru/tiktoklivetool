import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const stranger = '22222222-2222-4222-8222-222222222222'
await db.exec(`create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
insert into auth.users values ('${owner}'), ('${stranger}');`)
const schema = await readFile(new URL('../supabase/listener-storage.sql', import.meta.url), 'utf8')
await db.exec(schema)
await db.exec(schema)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`)
await db.query('insert into listeners(owner_id,tiktok_id,profile) values ($1,$2,$3)', [owner, 'listener', { userId: 'listener', username: 'User', birthdate: '1990年1月1日' }])
await db.query('insert into listener_chats(owner_id,tiktok_id,message_id,message,sent_at) values ($1,$2,$3,$4,$5)', [owner, 'listener', '1', { comment: 'hello' }, 1])
assert.equal((await db.query('select * from listeners')).rows.length, 1)
assert.equal((await db.query('select * from listener_chats')).rows.length, 1)
assert.ok((await db.query('select customer_id from listeners')).rows[0].customer_id)
await db.query('update listeners set profile = profile || $1::jsonb where tiktok_id = $2', [{ username: 'Edited' }, 'listener'])
assert.equal((await db.query('select profile from listeners')).rows[0].profile.username, 'Edited')
await assert.rejects(db.query('delete from listeners'), error => error.code === '42501')
await db.exec(`select set_config('request.jwt.claim.sub','${stranger}',false);`)
assert.equal((await db.query('select * from listeners')).rows.length, 0)
assert.equal((await db.query('select * from listener_chats')).rows.length, 0)
assert.equal((await db.query("update listeners set profile = '{}'::jsonb returning *")).rows.length, 0)
await assert.rejects(db.query('insert into listeners(owner_id,tiktok_id,profile) values ($1,$2,$3)', [owner, 'intruder', {}]), error => error.code === '42501')
await assert.rejects(db.query('insert into listener_chats(owner_id,tiktok_id,message_id,message,sent_at) values ($1,$2,$3,$4,$5)', [owner, 'listener', '2', {}, 2]), error => error.code === '42501')
await db.exec('reset role; set role anon;')
for (const table of ['listeners', 'listener_chats']) {
  await assert.rejects(db.query(`select * from ${table}`), error => error.code === '42501')
  await assert.rejects(db.query(`delete from ${table}`), error => error.code === '42501')
}
await db.close()
console.log('Cloud schema passed: owner read/write, other-account isolation, anonymous denial, delete denial, stable customer ID, idempotent setup.')

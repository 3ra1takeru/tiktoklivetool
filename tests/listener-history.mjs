import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { saveListenerChat, getListenerChats } from '../src/services/listenerHistory.ts'
for (let i = 0; i < 170; i++) {
  await saveListenerChat({ id: String(i), userId: 'listener-a', username: 'A', comment: `message ${i}`, timestamp: i })
}
await saveListenerChat({ id: '0', userId: 'listener-b', username: 'B', comment: 'other listener', timestamp: 0 })
await saveListenerChat({ id: '169', userId: 'listener-a', username: 'A', comment: 'message 169', timestamp: 169 })
const messages = await getListenerChats('listener-a')
assert.equal(messages.length, 170, 'history survives the 150-message display limit and deduplicates replay')
assert.equal(messages[0].comment, 'message 0')
assert.equal(messages.at(-1).comment, 'message 169')
assert.equal((await getListenerChats('listener-b')).length, 1)
assert.deepEqual(await getListenerChats('missing'), [])
console.log('Listener history tests passed: retention, ordering, isolation, replay deduplication.')

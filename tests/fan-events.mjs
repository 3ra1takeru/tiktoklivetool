import assert from 'node:assert/strict'
import { fanMembershipEvent } from '../server/fanEvents.ts'
assert.deepEqual(fanMembershipEvent({ common: { msgId: '123', displayText: { key: 'ttlive_superfan_new' } } }), { id: '123' })
assert.equal(fanMembershipEvent({ common: { msgId: '123' }, content: { key: 'ttlive_superfan_commentnotif_superfanjoined' } }, true), null)
assert.deepEqual(fanMembershipEvent({ msgId: '456' }, true), { id: '456' })
assert.deepEqual(fanMembershipEvent({ common: { msgId: '0', createTime: '12345' }, user: { id: '77' } }, true), { id: 'fan:77:12345' })
assert.equal(fanMembershipEvent({ common: { msgId: '123' }, content: { key: 'like' } }), null)
assert.equal(fanMembershipEvent({}, true), null)
console.log('PASS: new membership display variants, stable fallback ID, existing-member and unrelated-event rejection')

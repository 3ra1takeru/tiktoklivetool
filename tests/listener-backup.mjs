import assert from 'node:assert/strict'
import { mergeListener } from '../src/services/listenerBackup.ts'
const original = { userId: 'a', username: 'Current', birthdate: '1990年1月1日', history: [{ timestamp: 2, birthdate: '1990年1月1日', comment: 'a', summary: 'a' }], totalDiamonds: 10, totalPayPay: 1000 }
const incoming = { ...original, username: 'Old', birthdate: '1992年2月2日', history: [{ timestamp: 1, birthdate: '1992年2月2日', comment: 'b', summary: 'b' }], totalDiamonds: 5 }
const result = mergeListener(original, incoming)
assert.equal(result.username, 'Current')
assert.equal(result.birthdate, original.birthdate)
assert.equal(result.birthdates.length, 2)
assert.equal(result.history.length, 2)
assert.equal(result.totalDiamonds, 10)
const repeated = mergeListener(result, incoming)
assert.equal(repeated.birthdates.length, 2)
assert.equal(repeated.history.length, 2)
assert.equal(new Set(repeated.birthdates.map(r => r.id)).size, 2)
assert.equal(mergeListener(undefined, incoming).birthdates.length, 1)
assert.equal(original.birthdates, undefined)
console.log('Backup merge passed: preserves existing users, birthdays, histories, totals and deduplicates repeated imports.')

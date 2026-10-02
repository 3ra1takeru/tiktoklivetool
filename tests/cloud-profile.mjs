import assert from 'node:assert/strict'
import { rebaseCloudProfile } from '../src/services/cloudProfile.ts'
const record = (id, date) => ({ id, birthdate: date, relationship: '本人', name: '' })
const original = { userId: 'user', username: 'User', birthdate: '1990年1月1日', birthdates: [record('self', '1990年1月1日')], history: [], totalDiamonds: 0, totalPayPay: 0 }
const remote = { ...original, birthdates: [...original.birthdates, record('remote', '1991年1月1日')] }
const local = { ...original, birthdates: [...original.birthdates, record('local', '1992年1月1日')] }
const merged = rebaseCloudProfile(remote, original, local)
assert.equal(merged.birthdates.length, 3, 'concurrent additions are retained')
assert.equal(rebaseCloudProfile(remote, original, { ...original, birthdates: [] }).birthdates.length, 1, 'only records known to this device can be removed')
const empty = { ...original, birthdate: '', birthdates: [], history: [] }
assert.equal(rebaseCloudProfile(remote, undefined, empty).birthdate, original.birthdate, 'a first incoming comment cannot clear an existing profile')
assert.equal(remote.birthdates.length, 2, 'sources remain unchanged')
console.log('Cloud profile merge passed: concurrent birthdays retained, scoped removal, empty-comment preservation.')

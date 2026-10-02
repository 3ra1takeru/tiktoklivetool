import assert from 'node:assert/strict'
import { registeredBirthdate } from '../src/services/registeredBirthdate.ts'
assert.equal(registeredBirthdate({ birthdate: '', birthdates: [{ birthdate: '1990年1月1日', relationship: '本人' }] }), '1990年1月1日')
assert.equal(registeredBirthdate({ birthdate: '1991年1月1日', birthdates: [{ birthdate: '1992年2月2日', relationship: '家族' }, { birthdate: '1990年1月1日', relationship: '本人' }] }), '1990年1月1日')
assert.equal(registeredBirthdate({ birthdate: '1991年1月1日' }), '1991年1月1日')
assert.equal(registeredBirthdate({ birthdate: ' ', birthdates: [{ birthdate: '  ', relationship: '本人' }] }), '')
assert.equal(registeredBirthdate({ birthdates: [{ birthdate: '1992年2月2日', relationship: '家族' }] }), '1992年2月2日')
assert.equal(registeredBirthdate(), '')
console.log('Birthday registration tests passed: record-only,本人 priority, legacy data, empty records and missing profile.')

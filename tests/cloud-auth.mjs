import assert from 'node:assert/strict'
import { cloudAuthError, passwordSetupError } from '../src/services/cloudAuth.ts'
assert.match(cloudAuthError({ code:'over_email_send_rate_limit',status:429 }), /1時間に2通/)
assert.match(cloudAuthError({ code:'over_email_send_rate_limit',status:429 }), /パスワード/)
assert.match(cloudAuthError({ code:'invalid_credentials' }), /メールアドレスまたはパスワード/)
assert.match(cloudAuthError({ code:'reauthentication_needed' }), /再ログイン/)
assert.match(cloudAuthError({ status:429 }), /短時間/)
assert.equal(passwordSetupError('short','short') !== null,true)
assert.equal(passwordSetupError('long-password-123','different') !== null,true)
assert.equal(passwordSetupError('long-password-123','long-password-123'),null)
assert.ok(passwordSetupError('x'.repeat(129),'x'.repeat(129)))
console.log('PASS: quota-specific messages, credential failures, password length and confirmation validation')

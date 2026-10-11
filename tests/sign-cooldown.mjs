import assert from 'node:assert/strict';
import { signatureCooldown } from '../server/signCooldown.ts';
assert.equal(signatureCooldown({message:'[Rate Limited] (rate_limit_account_day) Too many connections started'}),86400000);
assert.equal(signatureCooldown({exception:{message:'rate_limit_account_hour'}}),3600000);
assert.equal(signatureCooldown({message:'Rate Limited'}),60000);
assert.equal(signatureCooldown({message:'User offline'}),0);
console.log('PASS signing quota day/hour/minute and unrelated errors');

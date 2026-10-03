import assert from 'node:assert/strict';
import { EventDeduplicator, giftSpeech } from '../src/services/liveEvents.ts';
import { completedGift } from '../server/giftEvents.ts';
const seen = new EventDeduplicator();
const announcements = [];
for (let n = 1; n <= 10; n++) {
  assert.equal(completedGift({ giftDetails: { giftType: 1 }, repeatEnd: false, repeatCount: n }), null);
}
const final = { giftDetails: { giftType: 1 }, repeatEnd: true, repeatCount: 10, groupId: 'group1', giftId: 5655, user: { uniqueId: 'viewer' }, common: { msgId: 'final' } };
for (const event of [final, { ...final, common: { msgId: 'replayed-final' } }]) {
  const gift = completedGift(event);
  if (seen.accept('gift:' + gift.id)) announcements.push(giftSpeech('リスナー', 'バラ', gift.count));
}
assert.deepEqual(announcements, ['リスナーさんから、バラのギフトを10個いただきました。']);
assert.ok(seen.accept('gift:' + completedGift({ ...final, groupId: 'group2' }).id));
assert.equal(completedGift({ giftDetails: { giftType: 2 }, common: { msgId: 'single' } }).count, 1);
for (let minute = 0; minute < 120; minute++) {
  for (let i = 0; i < 5; i++) assert.equal(seen.accept('chat:old' + i), minute === 0);
}
assert.ok(seen.accept('chat:new-message-with-same-text'));
console.log('Gift streak, duplicate gift, two-hour chat replay regression checks passed.');

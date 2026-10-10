import assert from 'node:assert/strict';
import { FanClubSound, fanClubNotes, giftNotes, isHeartMeGift } from '../src/services/fanClubSound.ts';
import { EventDeduplicator } from '../src/services/liveEvents.ts';
const oscillators = [];
class Context {
  state = 'running'; currentTime = 5; destination = {};
  createOscillator() {
    const node = { frequency: { value: 0 }, connect() {}, disconnect() {}, start(at) { this.startAt = at }, stop(at) { this.stopAt = at } };
    oscillators.push(node); return node;
  }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
  async resume() { this.state = 'running' }
  async close() { this.state = 'closed' }
}
globalThis.window = { AudioContext: Context };
const sound = new FanClubSound();
assert.equal(await sound.play(), false, 'No sound before browser gesture unlock');
sound.unlock();
const seen = new EventDeduplicator();
for (const id of ['new-fan', 'new-fan']) if (seen.accept(id)) await sound.play();
assert.equal(oscillators.length, fanClubNotes.length, 'Replayed membership sounds only once');
assert.deepEqual(oscillators.map(node => node.frequency.value), fanClubNotes);
await sound.play();
assert.ok(oscillators[6].startAt >= oscillators[5].stopAt, 'Sounds do not overlap');
sound.stop();
assert.ok(oscillators.every(node => node.stopAt === undefined), 'LIVE end cancels all scheduled notes');
assert.equal(await sound.play(), true, 'Next LIVE can sound without a new gesture');
const beforeGift = oscillators.length;
await sound.play('gift');
assert.equal(oscillators.length - beforeGift, 2);
assert.deepEqual(oscillators.slice(beforeGift).map(n => n.frequency.value), giftNotes);
assert.ok(oscillators.slice(beforeGift).every(n => n.type === 'sine'));
assert.equal(isHeartMeGift('ハートミー'), true);
assert.equal(isHeartMeGift('Heart Me'), true);
assert.equal(isHeartMeGift('バラ'), false);
sound.dispose();
assert.equal(await sound.play(), false);
console.log('PASS: gesture unlock, duplicate membership, original melody, FIFO, LIVE end, next LIVE');

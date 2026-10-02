import assert from 'node:assert/strict'
import { removeEmoji } from '../src/services/tts.ts'
assert.equal(removeEmoji('こんにちは😊🎉'), 'こんにちは')
assert.equal(removeEmoji('👨‍👩‍👧‍👦🇯🇵👍🏽❤️1️⃣'), '')
assert.equal(removeEmoji('1990年12月31日 #相談 * 1000円'), '1990年12月31日 #相談 * 1000円')
assert.equal(removeEmoji('たくみ⚽です。転職を考えています。'), 'たくみです。転職を考えています。')
console.log('Emoji removal tests passed.')

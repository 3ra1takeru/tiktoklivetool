import assert from 'node:assert/strict'
import { completedCaption } from '../server/captionEvents.ts'
const base={definite:true,sentenceId:'5',timestampMs:'1000',common:{msgId:'900'},content:[{lang:'en',content:'translation'},{lang:'ja-JP',content:'  こんにちは  '}]}
const caption=completedCaption(base,'host','1234567890123456789',100)
assert.equal(caption.text,'こんにちは');assert.equal(caption.language,'ja-JP')
assert.equal(caption.source,'tiktok_caption');assert.equal(caption.capturedAt,100)
assert.equal(completedCaption({...base,definite:false},'host','room'),null)
assert.equal(completedCaption({...base,content:[]},'host','room'),null)
assert.equal(completedCaption({...base,sentenceId:'0',common:{msgId:'0'},timestampMs:'0'},'host','room'),null)
assert.equal(completedCaption({...base,common:{msgId:'901'}},'host','room').id,caption.id,'Replayed sentence keeps identity despite transport ID changes')
assert.notEqual(completedCaption({...base,sentenceId:'6'},'host','room').id,caption.id,'Same words in a different sentence remain separate')
assert.equal(completedCaption({...base,sentenceId:'0'},'host','room').id,'900:ja-JP')
console.log('PASS: final-only captions, Japanese language selection, stable deduplication, repeated speech retained, missing IDs rejected')

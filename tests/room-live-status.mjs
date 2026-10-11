import assert from 'node:assert/strict';
import handler from '../api/tiktok-room.js';
const fetchBefore=globalThis.fetch;
async function lookup(data) {
  globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
  let output;const res={setHeader(){},status(code){this.code=code;return this},json(data){output=data;return this}};
  await handler({method:'GET',query:{username:'test'}},res);return {code:res.code,data:output};
}
try {
  const roomId='1234567890123456789';
  assert.equal((await lookup({data:{user:{roomId},liveRoom:{status:4}}})).data.live,false);
  assert.equal((await lookup({data:{user:{roomId},liveRoom:{status:2}}})).data.live,true);
  assert.equal((await lookup({data:{user:{roomId}}})).code,502);
  assert.equal((await lookup({data:{user:{roomId:'0'}}})).data.live,false);
  console.log('PASS live, ended room, offline and unknown status');
} finally {globalThis.fetch=fetchBefore}

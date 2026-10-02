import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
const username = process.argv[2];
if (!username) throw new Error('Usage: node tests/live-connection.mjs <LIVE username or URL>');
const args = process.argv.includes('--force-room-fallback') ? ['--import', new URL('./force-room-lookup-failure.mjs', import.meta.url).pathname, 'dist/server.js'] : ['dist/server.js'];
const server = spawn(process.execPath, args, {cwd:'server', env:{...process.env,PORT:'5003'},stdio:['ignore','pipe','pipe']});
let socket;
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  socket=io('http://localhost:5003',{reconnection:false});
  await new Promise((resolve,reject)=>{
    let connected=false, commentReceived=false;
    const complete=()=>{if(connected && commentReceived){clearTimeout(timer);resolve();}};
    const timer=setTimeout(()=>reject(new Error('LIVE connection/chat timed out')),50000);
    socket.on('connect',()=>socket.emit('join-tiktok',username));
    socket.on('tiktok-status',data=>{
      console.log('LIVE status:',JSON.stringify(data));
      if(data.status==='connected'){connected=true;complete();}
      if(data.status==='error'){clearTimeout(timer);reject(new Error(data.error));}
    });
    socket.once('chat-log',data=>{
      try {assert.ok(data.userId);assert.ok(data.username);assert.ok(data.comment);commentReceived=true;console.log('PASS: real LIVE comment forwarded with user ID, display name and text');complete();}catch(error){reject(error);}
    });
  });
} finally {socket?.emit('leave-tiktok');socket?.disconnect();server.kill();}

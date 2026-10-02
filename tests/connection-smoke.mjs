import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
const url = process.env.TEST_SERVER_URL || 'http://localhost:5001';
assert.equal((await (await fetch(`${url}/health`)).json()).status, 'ok');
const socket = io(url, { reconnection: false });
const next = event => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 5000);
  socket.once(event, value => { clearTimeout(timer); resolve(value); });
});
try {
  await next('connect');
  for (const input of ['日本語の表示名', '', 'https://example.com/@someone/live', null]) {
    const status = next('tiktok-status');
    socket.emit('join-tiktok', input);
    assert.equal((await status).status, 'error');
  }
  const status = next('tiktok-status');
  socket.emit('leave-tiktok');
  assert.equal((await status).status, 'disconnected');
  const chat = next('chat-log');
  socket.emit('send-mock-chat', 'valid');
  assert.equal((await chat).hasBirthdate, true);
  console.log('PASS: health, socket connection, invalid input, leave, chat forwarding');
} finally { socket.disconnect(); }

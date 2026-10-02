import { TikTokLiveConnection } from '../server/node_modules/tiktok-live-connector/dist/index.js';
// Test-only: reproduce the Render lookup failure while leaving signing and chat real.
TikTokLiveConnection.prototype.fetchRoomId = async function () {
  throw new Error('Failed to retrieve Room ID from all sources.');
};

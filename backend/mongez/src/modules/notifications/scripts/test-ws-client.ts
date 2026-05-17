import { io } from 'socket.io-client';

/**
 * MONGEZ WEBSOCKET TEST CLIENT
 * Use this to verify Real-time Notification Delivery and Presence (Heartbeats).
 * 
 * Usage: npx ts-node src/modules/notifications/scripts/test-ws-client.ts <YOUR_JWT_TOKEN>
 */

const URL = 'http://localhost:3000/ws';
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: Please provide a JWT token.');
  console.log('Usage: npx ts-node src/modules/notifications/scripts/test-ws-client.ts <token>');
  process.exit(1);
}

console.log('\x1b[34m%s\x1b[0m', `🔌 Connecting to ${URL}...`);

const socket = io(URL, {
  auth: { token: TOKEN },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('\x1b[32m%s\x1b[0m', '✅ Connected to Mongez Real-time Platform!');
  
  // Send initial heartbeat to mark user as ONLINE
  console.log('\x1b[35m%s\x1b[0m', '💓 Sending initial heartbeat to Presence Engine...');
  socket.emit('heartbeat');
  
  // Maintain presence every 30s
  setInterval(() => {
    console.log('\x1b[35m%s\x1b[0m', '💓 Sending presence heartbeat...');
    socket.emit('heartbeat');
  }, 30000);
});

socket.on('notification:received', (data) => {
  console.log('\n\x1b[33m%s\x1b[0m', '🔔 REAL-TIME NOTIFICATION RECEIVED:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\x1b[33m%s\x1b[0m', '------------------------------------\n');
});

socket.on('notification:new', (data) => {
  console.log('\n\x1b[36m%s\x1b[0m', '🆕 NEW NOTIFICATION ALERT:');
  console.log(data.title);
  console.log(data.body);
  console.log('\x1b[36m%s\x1b[0m', '---------------------------\n');
});

socket.on('notification:count', (data) => {
  console.log('\x1b[34m%s\x1b[0m', `📊 Badge Updated | Unread: ${data.unread} | Space: ${data.spaceId}`);
});

socket.on('disconnect', (reason) => {
  console.log('\x1b[31m%s\x1b[0m', `❌ Disconnected from server: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ Connection Error: ${err.message}`);
});

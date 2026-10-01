const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', () => {
  console.log('[TEST] Connected to backend WS');
  // Send generate_qr command
  ws.send(JSON.stringify({ type: 'generate_qr' }));
  console.log('[TEST] Sent generate_qr');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[TEST] Received:', JSON.stringify(msg, null, 2));
  if (msg.status === 'QR_CODE') {
    console.log('[TEST] SUCCESS: QR code received! Length:', msg.qr?.length || 0);
    ws.close();
    process.exit(0);
  } else if (msg.status === 'DISCONNECTED') {
    console.log('[TEST] Got DISCONNECTED — check backend logs for reason');
  } else if (msg.status === 'CONNECTING') {
    console.log('[TEST] Connecting...');
  }
});

ws.on('error', (err) => {
  console.error('[TEST] WS error:', err.message);
});

// 30s timeout
setTimeout(() => {
  console.log('[TEST] TIMEOUT: No QR received in 30s');
  ws.close();
  process.exit(1);
}, 30000);

import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

const clients = new Map(); // clientId => WebSocket

console.log(`WebSocket server running on ws://localhost:${PORT}`);

// Handle incoming connections
wss.on('connection', (ws) => {
  let clientId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'register') {
        // Register a client
        clientId = msg.clientId;
        clients.set(clientId, ws);
        console.log(`Registered client ${clientId}`);
      }

      else if (msg.type === 'send') {
        // Relay encrypted file or public key
        const target = clients.get(msg.to);
        if (target) {
          target.send(JSON.stringify({
            from: clientId,
            payload: msg.payload,
            isFile: msg.isFile || false
          }));
        }
      }

    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  });

  ws.on('close', () => {
    if (clientId) clients.delete(clientId);
    console.log(`Disconnected client ${clientId}`);
  });
});
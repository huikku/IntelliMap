/**
 * Server-Sent Events (SSE) for live reload
 */

const clients = new Set();

export function setupSSE(app) {
  app.get('/events', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');
    
    // Add client to set
    clients.add(res);
    
    // Remove client on disconnect
    req.on('close', () => {
      clients.delete(res);
    });
  });
}

export function notifyClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  for (const client of clients) {
    try {
      client.write(message);
    } catch (error) {
      clients.delete(client);
    }
  }
}


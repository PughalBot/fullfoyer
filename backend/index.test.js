const { Server } = require('jest-websocket-mock');
const server = require('./index'); // Path to your server file

describe('Chat Room', () => {
  let ws;
  let client;

  beforeEach(() => {
    ws = new Server('ws://localhost:5000');
    client = ws.clients[0];
  });

  afterEach(() => {
    Server.cleanAll();
    ws.close();
  });

  test('a user can send a message', async () => {
    client.send(JSON.stringify({ sender: 'testuser', content: 'Hello, world!' }));
    await expect(server).toReceiveMessage(
      JSON.stringify({ sender: 'testuser', content: 'Hello, world!' })
    );
    expect(server).toHaveReceivedMessages([
      JSON.stringify({ sender: 'testuser', content: 'Hello, world!' })
    ]);
  });

  test('a user receives the last 50 messages on request', async () => {
    client.send('requestHistory');
    await server.connectedClients[0].send('history', /* Last 50 messages here */);
    expect(server).toHaveReceivedMessages(['requestHistory']);
    // ... Add more checks here ...
  });

  test('a user tries to exceed the rate limit', async (done) => {
    // Send 16 messages in a row
    for (let i = 0; i < 16; i++) {
      client.send(JSON.stringify({ sender: 'testuser', content: `message ${i}` }));
    }
    await expect(server).toReceiveMessage('rateLimitExceeded');
    // ... Add more checks here ...
    done();
  });

  // ... Add more test cases here ...
});

const port = 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}


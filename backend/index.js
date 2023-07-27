const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const redis = require('redis');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
});

const redisClient = redis.createClient();

const messageLimit = 15;
const timeFrame = 60 * 1000; // 1 minute

const limiter = rateLimit({
  windowMs: timeFrame,
  max: messageLimit,
  message: 'You have exceeded the message limit. Please wait a moment.',
});

const userMessageCount = {};

io.on('connection', (socket) => {
  socket.on('error', (err) => {
    console.log('Received socket error:');
    console.log(err);
  });

  // Fetch the last 50 messages from Redis and send to the client
  socket.on('requestHistory', () => {
    redisClient.lrange('chat_messages', -50, -1, (err, data) => {
      if (err) {
        console.error('Error retrieving messages from Redis:', err);
        return;
      }
      const parsedMessages = data.map(message => JSON.parse(message));
      socket.emit('history', parsedMessages);
    });
  });

  // Handle new messages
  socket.on('message', (data) => {
    const { sender } = data;
    if (!userMessageCount[sender]) userMessageCount[sender] = 0;

    if (userMessageCount[sender] < messageLimit) {
      const { content, timestamp } = data;

      const message = JSON.stringify({ sender, content, timestamp });
      redisClient.rpush('chat_messages', message, (err) => {
        if (err) {
          console.error('Error storing message in Redis:', err);
          return;
        }

        // Send the new message to all connected clients
        io.emit('message', data);
        userMessageCount[sender] += 1;
      });
    } else {
      socket.emit('rateLimitExceeded', 'You have exceeded the message limit. Please wait a moment.');
    }

    setTimeout(() => {
      userMessageCount[sender] = 0;
    }, timeFrame);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const port = 5000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

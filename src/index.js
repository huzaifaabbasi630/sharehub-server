const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db.js');
const roomRoutes = require('./routes/roomRoutes.js');
const messageRoutes = require('./routes/messageRoutes.js');
const joinRoutes = require('./config/joinRoutes.js');
const { setupSocketHandlers } = require('./sockets/socketHandler.js');
const { setupCallSocket } = require('./sockets/callSocket.js');
const { setupWebRTCSignaling } = require('./webrtc/signaling.js');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));
app.use(express.json());

connectDB();

app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/join', joinRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

setupSocketHandlers(io);
setupCallSocket(io);
setupWebRTCSignaling(io);

// For local development only
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, httpServer, io };

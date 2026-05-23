const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { setupSocketHandlers } = require("./sockets/socketHandler");
const { setupCallSocket } = require("./sockets/callSocket");
const { setupWebRTCSignaling } = require("./webrtc/signaling");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Proper CORS - Supports multiple origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.PRODUCTION_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ MongoDB Connection with Retry Logic
const connectMongoDB = async (retries = 5, delay = 3000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4 to avoid DNS issues
      });
      console.log("✅ MongoDB Connected Successfully");
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i}/${retries} failed:`, err.message);
      if (i < retries) {
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error("❌ All MongoDB connection attempts failed. Server running without DB.");
      }
    }
  }
};

connectMongoDB();

// ✅ Import Routes
const roomRoutes = require("./routes/roomRoutes.js");
const messageRoutes = require("./routes/messageRoutes.js");
const joinRequestRoutes = require("./routes/joinRequestRoutes.js");

// ✅ Socket.io Setup with proper CORS (must be before routes that use io)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket'], // Force WebSocket only
  allowUpgrades: false // Disable upgrade from polling
});

// ✅ Health Route
app.get("/", (req, res) => {
  res.send("🚀 ShareHub Backend Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// ✅ Attach io to req so routes can use WebSockets
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", joinRequestRoutes);

setupSocketHandlers(io);
setupCallSocket(io);
setupWebRTCSignaling(io);

// ✅ IMPORTANT — Render uses this PORT
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
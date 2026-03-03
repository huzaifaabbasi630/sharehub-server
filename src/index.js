const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { setupSocketHandlers } = require("./socket/sockethandler");
const { setupCallSocket } = require("./socket/callsocket");
const { setupWebRTCSignaling } = require("./webrtc/signaling");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Proper CORS
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use(express.json());

// ✅ MongoDB Safe Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ Mongo Error:", err.message);
  });

// ✅ Health Route
app.get("/", (req, res) => {
  res.send("🚀 ShareHub Backend Running on Render");
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// ✅ Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

setupSocketHandlers(io);
setupCallSocket(io);
setupWebRTCSignaling(io);

// ✅ IMPORTANT — Render uses this PORT
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
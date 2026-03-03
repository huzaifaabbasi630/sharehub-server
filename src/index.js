const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Pusher = require("pusher");
const mongoose = require("mongoose");

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*"
}));

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Mongo Error:", err.message));

// Pusher Config
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Example route
app.post("/api/messages", async (req, res) => {
  const { roomId, message, sender } = req.body;

  // Save to MongoDB (agar model hai to yahan save karo)

  // Trigger realtime event
  await pusher.trigger(`room-${roomId}`, "new-message", {
    message,
    sender,
    timestamp: new Date()
  });

  res.json({ success: true });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

module.exports = app;
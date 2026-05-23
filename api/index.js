const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load environment variables
dotenv.config();

const app = express();

// ✅ Allowed Origins - supports both dev and production
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.PRODUCTION_CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
].filter(Boolean);

// ✅ CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin requests) or requests from allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.json({ message: "Backend working on Vercel 🚀" });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// MongoDB connection (if using)
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));
}

// Import your existing routes
const roomRoutes = require("../src/routes/roomRoutes");
const messageRoutes = require("../src/routes/messageRoutes");

// Your existing routes
app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);

// YAHAN app.listen NAHI likhna

module.exports = app;
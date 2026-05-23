'use strict';

const Pusher = require('pusher');

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getPusher() {
  return new Pusher({
    appId: getEnv('VITE_PUSHER_APP_ID'),
    key: getEnv('VITE_PUSHER_KEY'),
    secret: getEnv('VITE_PUSHER_SECRET'),
    cluster: getEnv('VITE_PUSHER_CLUSTER'),
    useTLS: true,
  });
}

function handleCors(req, res) {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.PRODUCTION_CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ].filter(Boolean);

  const origin = req.headers.origin;
  
  // Allow the origin if it's in our list or if in development
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow all origins
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // In production, only allow specific origins
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || 'http://localhost:3000');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // Indicates that the request was handled
  }
  return false;
}

module.exports = {
    getPusher,
    handleCors,
};
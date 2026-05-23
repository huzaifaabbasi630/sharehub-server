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

const { handleCors } = require('./_utils.js');

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  console.log('[join-request] start', {
    method: req.method,
    url: req.url,
    now: new Date().toISOString(),
  });

  // ✅ CORS handling
  if (handleCors(req, res)) {
    console.log('[join-request] preflight');
    return;
  }

  if (req.method !== 'POST') {
    console.warn('[join-request] invalid method', req.method);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { roomCode, user } = req.body || {};

    if (!roomCode || typeof roomCode !== 'string') {
      return res.status(400).json({ ok: false, message: 'roomCode is required' });
    }
    if (!user || typeof user !== 'object') {
      return res.status(400).json({ ok: false, message: 'user is required' });
    }

    const channel = `room-${roomCode}`;
    const pusher = getPusher();

    console.log('[join-request] triggering pusher', { channel, event: 'join-request' });

    await pusher.trigger(channel, 'join-request', {
      roomCode,
      user,
      ts: new Date().toISOString(),
    });

    console.log('[join-request] success', { ms: Date.now() - startedAt });

    return res.status(200).json({
      ok: true,
      message: 'Join request sent',
      roomCode,
    });
  } catch (err) {
    console.error('[join-request] error', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to send join request',
      error: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
    });
  }
};

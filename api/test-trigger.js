'use strict';

const Pusher = require('pusher');

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getPusher() {
  return new Pusher({
    appId: getEnv('PUSHER_APP_ID'),
    key: getEnv('PUSHER_KEY'),
    secret: getEnv('PUSHER_SECRET'),
    cluster: getEnv('PUSHER_CLUSTER'),
    useTLS: true,
  });
}

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  console.log('[test-trigger] start', {
    method: req.method,
    url: req.url,
    now: new Date().toISOString(),
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log('[test-trigger] preflight');
    return res.status(204).end();
  }

  try {
    const roomCode =
      (req.query && req.query.roomCode) ||
      (req.body && req.body.roomCode) ||
      'DEBUG';

    const channel = `room-${roomCode}`;
    const pusher = getPusher();

    console.log('[test-trigger] triggering pusher', {
      channel,
      event: 'debug',
    });

    await pusher.trigger(channel, 'debug', {
      roomCode,
      message: 'Test trigger fired',
      ts: new Date().toISOString(),
    });

    console.log('[test-trigger] success', { ms: Date.now() - startedAt });

    return res.status(200).json({
      ok: true,
      message: 'Debug event sent',
      channel,
      event: 'debug',
    });
  } catch (err) {
    console.error('[test-trigger] error', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to send debug event',
      error: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
    });
  }
};

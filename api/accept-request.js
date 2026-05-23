'use strict';

const { getPusher, handleCors } = require('./_utils.js');

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  console.log('[accept-request] start', {
    method: req.method,
    url: req.url,
    now: new Date().toISOString(),
  });

  if (handleCors(req, res)) {
    console.log('[accept-request] preflight');
    return;
  }

  if (req.method !== 'POST') {
    console.warn('[accept-request] invalid method', req.method);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { roomCode, meetingPath, acceptedBy } = req.body || {};

    if (!roomCode || typeof roomCode !== 'string') {
      return res.status(400).json({ ok: false, message: 'roomCode is required' });
    }

    const channel = `room-${roomCode}`;
    const pusher = getPusher();

    console.log('[accept-request] triggering pusher', {
      channel,
      event: 'request-accepted',
    });

    await pusher.trigger(channel, 'request-accepted', {
      roomCode,
      meetingPath: meetingPath || `/meeting/${roomCode}`,
      acceptedBy: acceptedBy || null,
      ts: new Date().toISOString(),
    });

    console.log('[accept-request] success', { ms: Date.now() - startedAt });

    return res.status(200).json({
      ok: true,
      message: 'Request accepted',
      roomCode,
    });
  } catch (err) {
    console.error('[accept-request] error', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to accept request',
      error: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
    });
  }
};

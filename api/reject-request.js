'use strict';

const { getPusher, handleCors } = require('./_utils.js');

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  console.log('[reject-request] start', {
    method: req.method,
    url: req.url,
    now: new Date().toISOString(),
  });

  if (handleCors(req, res)) {
    console.log('[reject-request] preflight');
    return;
  }

  if (req.method !== 'POST') {
    console.warn('[reject-request] invalid method', req.method);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { roomCode, reason, rejectedBy } = req.body || {};

    if (!roomCode || typeof roomCode !== 'string') {
      return res.status(400).json({ ok: false, message: 'roomCode is required' });
    }

    const channel = `room-${roomCode}`;
    const pusher = getPusher();

    console.log('[reject-request] triggering pusher', {
      channel,
      event: 'request-rejected',
    });

    await pusher.trigger(channel, 'request-rejected', {
      roomCode,
      reason: reason || 'Rejected by creator',
      rejectedBy: rejectedBy || null,
      ts: new Date().toISOString(),
    });

    console.log('[reject-request] success', { ms: Date.now() - startedAt });

    return res.status(200).json({
      ok: true,
      message: 'Request rejected',
      roomCode,
    });
  } catch (err) {
    console.error('[reject-request] error', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to reject request',
      error: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
    });
  }
};

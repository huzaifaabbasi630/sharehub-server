const express = require('express');
const router = express.Router();
const pusher = require('../config/pusher');

// POST /api/join/request
// Triggered by the Joiner
router.post('/request', async (req, res) => {
  const { roomCode, user } = req.body;
  console.log(`[Join Request] Room: ${roomCode}, User: ${user?.name || 'Unknown'}`);

  if (!roomCode || !user) {
    console.error('[Join Request] Missing data');
    return res.status(400).json({ error: 'Missing roomCode or user data' });
  }

  try {
    // Broadcast to the room channel
    // Event: 'join-request'
    console.log(`[Pusher] Triggering 'join-request' on channel 'room-${roomCode}'`);
    await pusher.trigger(`room-${roomCode}`, 'join-request', user);
    
    console.log('[Pusher] Event triggered successfully');
    res.status(200).json({ success: true, message: 'Join request sent' });
  } catch (error) {
    console.error('Pusher Trigger Error:', error);
    res.status(500).json({ error: 'Failed to send join request' });
  }
});

// POST /api/join/respond
// Triggered by the Creator (Host)
router.post('/respond', async (req, res) => {
  const { roomCode, userId, status } = req.body; // status: 'accepted' | 'rejected'
  console.log(`[Join Respond] Room: ${roomCode}, User: ${userId}, Status: ${status}`);

  if (!roomCode || !userId || !['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid response data' });
  }

  const eventName = status === 'accepted' ? 'request-accepted' : 'request-rejected';

  try {
    console.log(`[Pusher] Triggering '${eventName}' on channel 'room-${roomCode}'`);
    await pusher.trigger(`room-${roomCode}`, eventName, { userId });
    res.status(200).json({ success: true, status });
  } catch (error) {
    console.error('Pusher Trigger Error:', error);
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

module.exports = router;
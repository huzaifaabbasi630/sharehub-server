const express = require('express');
const router = express.Router();

// POST /api/join-request - Send a join request to room via WebSockets
router.post('/join-request', async (req, res) => {
  try {
    const { roomCode, user } = req.body;

    console.log('📨 Join request via Socket.io:', { roomCode, user });

    if (!roomCode || typeof roomCode !== 'string') {
      return res.status(400).json({ success: false, error: 'roomCode is required' });
    }

    const upperCode = roomCode.toUpperCase();
    
    // Trigger via Socket.io instead of Pusher
    if (req.io) {
      req.io.to(upperCode).emit('join_request_received', {
        requestId: user?.id || `req-${Date.now()}`,
        requesterId: user?.id || null,
        requesterName: user?.name,
        userName: user?.name,
        ts: new Date().toISOString()
      });
      console.log('✅ Socket.io join-request event emitted to room:', upperCode);
    } else {
      console.warn('⚠️ req.io not found in request');
    }

    res.json({
      success: true,
      ok: true,
      message: 'Join request sent',
      roomCode: upperCode
    });
  } catch (error) {
    console.error('❌ Join request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/accept-request - Accept a join request via WebSockets
router.post('/accept-request', async (req, res) => {
  try {
    const { roomCode, meetingPath, acceptedBy, requesterId, requesterName } = req.body;

    console.log('📨 Accept request via Socket.io:', { roomCode, meetingPath, acceptedBy, requesterId, requesterName });

    if (!roomCode || typeof roomCode !== 'string') {
      return res.status(400).json({ success: false, error: 'roomCode is required' });
    }

    const upperCode = roomCode.toUpperCase();

    // ✅ Emit to both the specific requester AND the room via Socket.io
    if (req.io) {
      const eventData = {
        roomCode: upperCode,
        meetingPath: meetingPath || `/room/${upperCode}`,
        acceptedBy: acceptedBy || null,
        requesterId: requesterId || null,
        requesterName: requesterName || null,
        ts: new Date().toISOString()
      };

      // Notify the requester specifically if we have their socket ID
      if (requesterId) {
        req.io.to(requesterId).emit('join_approved', eventData);
        req.io.to(requesterId).emit('request-accepted', eventData);
      }

      // Also broadcast to the room
      req.io.to(upperCode).emit('request-accepted', eventData);
      
      console.log('✅ Socket.io accept events emitted to requester:', requesterId, 'and room:', upperCode);
    } else {
      console.warn('⚠️ req.io not found in request');
    }

    res.json({
      success: true,
      ok: true,
      message: 'Request accepted',
      roomCode: upperCode
    });
  } catch (error) {
    console.error('❌ Accept request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

const { Room } = require('../models/Room.js');
const { Message } = require('../models/Message.js');
const { JoinRequest } = require('../models/JoinRequest.js');
const { inMemoryRooms, inMemoryMessages, inMemoryJoinRequests } = require('../utils/memoryStore.js');
const aiService = require('../services/aiService');

const activeUsers = new Map();

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', async (data) => {
      try {
        const { roomCode, userName } = data;
        const upperCode = roomCode.toUpperCase();
        
        socket.join(upperCode);
        activeUsers.set(socket.id, { roomCode: upperCode, userName, isHost: true });
        
        // Also track in shared memory for lookup
        if (!inMemoryRooms.has(upperCode)) {
          inMemoryRooms.set(upperCode, {
            _id: Date.now().toString(),
            code: upperCode,
            name: 'Room ' + upperCode,
            hostId: socket.id,
            hostName: userName,
            participants: [{ socketId: socket.id, name: userName }],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        socket.emit('room_created', { roomCode: upperCode, socketId: socket.id });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('send_join_request', async (data) => {
      try {
        const { roomCode, userName, isOneTimeLink, token } = data;
        const upperCode = roomCode.toUpperCase();
        
        console.log('Join request for room:', upperCode, 'One-time link:', isOneTimeLink);
        console.log('Available rooms:', Array.from(inMemoryRooms.keys()));
        
        let room = null;
        
        // Try MongoDB first
        try {
          room = await Room.findOne({ code: upperCode });
          console.log('Found room in MongoDB:', room ? 'yes' : 'no');
        } catch (dbError) {
          console.log('MongoDB error:', dbError.message);
        }
        
        // If not found in MongoDB, try in-memory
        if (!room) {
          room = inMemoryRooms.get(upperCode);
          console.log('Found room in memory:', room ? 'yes' : 'no');
        }
        
        // For one-time links, allow the request even if room not found in DB
        // (the room might only exist in creator's localStorage)
        if (!room && isOneTimeLink) {
          console.log('One-time link request - room not found but allowing request');
          // Create a temporary room entry for the request
          room = {
            _id: upperCode,
            code: upperCode,
            name: 'Room ' + upperCode
          };
        }
        
        if (!room) {
          console.log('Room not found anywhere');
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        let requestId;
        try {
          const joinRequest = await JoinRequest.create({
            roomId: room._id || room.code,
            requesterId: socket.id,
            requesterName: userName,
            status: 'pending'
          });
          requestId = joinRequest._id;
        } catch (dbError) {
          // Fallback to in-memory
          requestId = Date.now().toString();
          inMemoryJoinRequests.push({
            _id: requestId,
            roomId: room._id || room.code,
            requesterId: socket.id,
            requesterName: userName,
            status: 'pending'
          });
        }

        console.log('Broadcasting join_request_received to room:', upperCode);
        console.log('Socket rooms:', Array.from(socket.rooms));
        io.to(upperCode).emit('join_request_received', {
          requestId: requestId,
          requesterId: socket.id,
          requesterName: userName,
          userName: userName
        });

        socket.emit('join_request_sent', { requestId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('approve_join', async (data) => {
      try {
        const { requestId, requesterId, roomCode, requesterName } = data;
        const upperCode = roomCode.toUpperCase();
        
        // Update join request status
        try {
          await JoinRequest.findByIdAndUpdate(requestId, { status: 'approved' });
        } catch (dbError) {
          console.log('Could not update join request in MongoDB');
        }
        
        // Find room - try MongoDB first, then in-memory
        let room = null;
        try {
          room = await Room.findOne({ code: upperCode });
        } catch (dbError) {
          console.log('MongoDB error, using in-memory');
        }
        
        if (!room) {
          room = inMemoryRooms.get(upperCode);
        }
        
        if (room) {
          // Notify User B (the requester) - redirect them to chat
          io.to(requesterId).emit('join_approved', {
            roomId: room._id || room.code,
            roomCode: upperCode,
            roomName: room.name
          });
          
          // Notify User A (the host) - redirect them to chat too
          socket.emit('join_approved_notification', {
            requesterId,
            requesterName
          });
        } else {
          socket.emit('error', { message: 'Room not found for approval' });
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('reject_join', async (data) => {
      try {
        const { requestId, requesterId } = data;
        
        await JoinRequest.findByIdAndUpdate(requestId, { status: 'rejected' });
        
        io.to(requesterId).emit('join_rejected', {
          message: 'Your join request was rejected by the host'
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('join_room', async (data) => {
      try {
        const { roomCode, userName, isHost } = data;
        const upperCode = roomCode.toUpperCase();
        
        socket.join(upperCode);
        activeUsers.set(socket.id, { roomCode: upperCode, userName, isHost });
        
        const room = await Room.findOne({ code: upperCode });
        
        if (room && !isHost) {
          room.participants.push({ socketId: socket.id, name: userName });
          await room.save();
        }
        
        socket.to(upperCode).emit('user_joined', {
          socketId: socket.id,
          userName,
          isHost: isHost || false
        });
        
        socket.emit('joined_room', { roomCode: upperCode, roomId: room?._id });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { roomId, roomCode, senderId, senderName, content, type, fileUrl, fileName } = data;
        
        let message;
        try {
          message = await Message.create({
            roomId,
            senderId,
            senderName,
            content,
            type: type || 'text',
            fileUrl,
            fileName
          });
        } catch (dbError) {
          // Fallback to in-memory
          message = {
            _id: Date.now().toString(),
            roomId,
            senderId,
            senderName,
            content,
            type: type || 'text',
            fileUrl,
            fileName,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const roomMessages = inMemoryMessages.get(roomId) || [];
          roomMessages.push(message);
          inMemoryMessages.set(roomId, roomMessages);
        }
        
        const upperCode = roomCode.toUpperCase();
        io.to(upperCode).emit('new_message', message);

        // ── AI Smart Reply ──
        if (type === 'text' && !content.startsWith('/')) {
           const replies = await aiService.generateSmartReplies(content);
           socket.emit('ai_smart_replies', { messageId: message._id, replies });
        }

        // ── AI Image Generation ──
        if (type === 'text' && content.startsWith('/image')) {
          const imageUrl = await aiService.generateImagePrompt(content);
          const aiMessage = {
            _id: Date.now().toString(),
            roomId,
            senderId: 'ai-assistant',
            senderName: 'AI Work Assistant',
            content: `Generated image for: ${content.replace('/image', '').trim()}`,
            type: 'image',
            fileUrl: imageUrl,
            createdAt: new Date()
          };
          io.to(upperCode).emit('new_message', aiMessage);
        }

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ── AI Chat Assistant ──
    socket.on('ai_assistant_query', async (data) => {
      try {
        const { roomCode, query, chatHistory } = data;
        const upperCode = roomCode.toUpperCase();
        const response = await aiService.getAssistantResponse(query, chatHistory);
        const aiMessage = {
          _id: Date.now().toString(),
          roomId: data.roomId, 
          senderId: 'ai-assistant',
          senderName: 'AI Work Assistant',
          content: response,
          type: 'text',
          createdAt: new Date()
        };
        io.to(upperCode).emit('new_message', aiMessage);
      } catch (err) {
        console.error('AI Assistant Error:', err);
      }
    });

    socket.on('summarize_chat', async (data) => {
      try {
        const { messages } = data;
        const summary = await aiService.summarizeChat(messages);
        socket.emit('chat_summary_result', { summary });
      } catch (err) {
        socket.emit('error', { message: 'Summarization failed' });
      }
    });

    socket.on('improve_message', async (data) => {
      try {
        const { text } = data;
        const improved = await aiService.improveMessage(text);
        socket.emit('improved_message_result', { improved });
      } catch (err) {
        socket.emit('error', { message: 'Improvement failed' });
      }
    });

    socket.on('translate_message', async (data) => {
      try {
        const { text, targetLang } = data;
        const translated = await aiService.translateMessage(text, targetLang);
        socket.emit('translated_message_result', { translated, originalText: text });
      } catch (err) {
        socket.emit('error', { message: 'Translation failed' });
      }
    });

    socket.on('typing', (data) => {
      const { roomCode, userName, isTyping } = data;
      socket.to(roomCode).emit('user_typing', { userName, isTyping });
    });

    socket.on('security_settings_changed', (data) => {
      const { roomCode, userName, message, timestamp } = data;
      const upperCode = roomCode.toUpperCase();
      
      // Create a system message that will be broadcast to all users
      const systemMessage = {
        _id: `security_${Date.now()}`,
        roomId: upperCode,
        senderId: 'system',
        senderName: 'System',
        content: message,
        type: 'system',
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      // Broadcast to ALL users in the room (including sender)
      io.to(upperCode).emit('new_message', systemMessage);
    });

    // Handle security settings broadcast to all room members
    socket.on('security_settings_broadcast', (data) => {
      const { roomCode, settings, timestamp } = data;
      const upperCode = roomCode.toUpperCase();
      
      console.log(`Broadcasting security settings to room ${upperCode}`);
      
      // Broadcast to ALL users in the room (including sender)
      io.to(upperCode).emit('security_settings_broadcast', {
        roomCode: upperCode,
        settings,
        timestamp
      });
    });

    socket.on('start_call', (data) => {
      const { roomCode, callerId, callerName, callType, isHost } = data;
      const upperCode = roomCode.toUpperCase();
      console.log(`Call started in room ${upperCode} by ${callerName} (${callType})`);
      socket.to(upperCode).emit('incoming_call', {
        callerId,
        callerName,
        callType,
        roomCode: upperCode,
        isHost
      });
    });

    socket.on('join_call', (data) => {
      const { roomCode, userId, userName } = data;
      const upperCode = roomCode.toUpperCase();
      socket.to(upperCode).emit('user_joined_call', { userId, userName });
    });

    socket.on('webrtc_offer', (data) => {
      const { targetId, offer, senderId } = data;
      io.to(targetId).emit('webrtc_offer', { offer, senderId });
    });

    socket.on('webrtc_answer', (data) => {
      const { targetId, answer, senderId } = data;
      io.to(targetId).emit('webrtc_answer', { answer, senderId });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { targetId, candidate, senderId } = data;
      io.to(targetId).emit('webrtc_ice_candidate', { candidate, senderId });
    });

    socket.on('mute_audio', (data) => {
      const { roomCode, userId, muted } = data;
      socket.to(roomCode.toUpperCase()).emit('user_muted_audio', { userId, muted });
    });

    socket.on('disable_video', (data) => {
      const { roomCode, userId, disabled } = data;
      socket.to(roomCode.toUpperCase()).emit('user_disabled_video', { userId, disabled });
    });

    socket.on('leave_call', (data) => {
      const { roomCode, userId } = data;
      socket.to(roomCode.toUpperCase()).emit('user_left_call', { userId });
    });

    socket.on('end_call', (data) => {
      const { roomCode, userId } = data;
      socket.to(roomCode.toUpperCase()).emit('call_ended', { userId });
    });

    // Education Mode Events
    socket.on('start_quiz', (data) => {
      const { roomCode, quiz } = data;
      const upperCode = roomCode.toUpperCase();
      console.log(`Quiz started in room ${upperCode}`);
      socket.to(upperCode).emit('incoming_quiz', quiz);
    });

    socket.on('submit_quiz_answer', (data) => {
      const { roomCode, userName, optionIndex } = data;
      const upperCode = roomCode.toUpperCase();
      socket.to(upperCode).emit('quiz_response_received', { userName, optionIndex });
    });

    socket.on('attendance_request', (data) => {
      const { roomCode, targetName, requesterName, id } = data;
      const upperCode = roomCode.toUpperCase();
      console.log(`Attendance requested for ${targetName || 'everyone'} in room ${upperCode} with ID: ${id}`);
      socket.to(upperCode).emit('attendance_request', { targetName, requesterName, id });
    });

    socket.on('attendance_response', (data) => {
      const { roomCode, userName, status } = data;
      const upperCode = roomCode.toUpperCase();
      socket.to(upperCode).emit('attendance_response', { userName, status });
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      const user = activeUsers.get(socket.id);
      
      if (user) {
        socket.to(user.roomCode).emit('user_left', {
          socketId: socket.id,
          userName: user.userName
        });
        
        const room = await Room.findOne({ code: user.roomCode });
        if (room) {
          room.participants = room.participants.filter(p => p.socketId !== socket.id);
          await room.save();
        }
        
        activeUsers.delete(socket.id);
      }
    });
  });
};

module.exports = { setupSocketHandlers };

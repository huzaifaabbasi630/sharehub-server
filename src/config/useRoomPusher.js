import { useEffect, useRef } from 'react';
import Pusher from 'pusher-js';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;

/**
 * Hook to handle Pusher subscriptions for Room Join logic.
 * @param {string} roomCode - The unique room code.
 * @param {boolean} isCreator - True if current user is the host.
 * @param {string} currentUserId - The ID of the current user (to filter events).
 * @param {object} callbacks - { onJoinRequest, onAccepted, onRejected }
 */
export const useRoomPusher = (roomCode, isCreator, currentUserId, callbacks) => {
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;

    // 1. Initialize Pusher
    // Enable logging only in dev
    Pusher.logToConsole = import.meta.env.DEV; 
    
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });

    // 2. Subscribe to the room channel
    const channelName = `room-${roomCode}`;
    channelRef.current = pusherRef.current.subscribe(channelName);

    // 3. Bind Events
    if (isCreator) {
      // Creator listens for requests
      channelRef.current.bind('join-request', (data) => {
        if (callbacks.onJoinRequest) callbacks.onJoinRequest(data);
      });
    } else {
      // Joiner listens for responses
      channelRef.current.bind('request-accepted', (data) => {
        if (data.userId === currentUserId && callbacks.onAccepted) {
          callbacks.onAccepted();
        }
      });

      channelRef.current.bind('request-rejected', (data) => {
        if (data.userId === currentUserId && callbacks.onRejected) {
          callbacks.onRejected();
        }
      });
    }

    // 4. Cleanup on Unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current.unsubscribe();
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, [roomCode, isCreator, currentUserId]); // Re-run only if these change
};
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const sendJoinRequest = async (roomCode, user) => {
  const response = await fetch("https://your-backend-project.vercel.app/api/join-request", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, user }),
  });
  
  if (!response.ok) throw new Error('Failed to send join request');
  return response.json();
};

export const respondToJoinRequest = async (roomCode, userId, status) => {
  const response = await fetch(`${API_URL}/join/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, userId, status }),
  });

  if (!response.ok) throw new Error('Failed to respond');
  return response.json();
};
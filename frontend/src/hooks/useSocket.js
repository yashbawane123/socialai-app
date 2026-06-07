import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './useAuth';

export function useSocket(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // Initialize Socket connection using API_BASE
    const socketInstance = io(API_BASE, {
      auth: { token }
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('🔌 Real-time WebSocket connection established');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return {
    socket,
    connected
  };
}

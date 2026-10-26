import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_URL } from '../lib/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [friendActivity, setFriendActivity] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);

  useEffect(() => {
    if (!token || !user) return;
    if (process.env.NODE_ENV === 'production' && API_URL.startsWith('/')) return;

    const socketInstance = io(API_URL.replace(/\/api\/?$/, ''), {
      auth: { token }
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
    });

    socketInstance.on('current_playing', (data) => {
      setCurrentPlaying(data);
    });

    socketInstance.on('friend_playing', (data) => {
      setFriendActivity(prev => [data, ...prev].slice(0, 20));
    });

    socketInstance.on('user_online', ({ userId }) => {
      setOnlineFriends(prev => [...prev, userId]);
    });

    socketInstance.on('user_offline', ({ userId }) => {
      setOnlineFriends(prev => prev.filter(id => id !== userId));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user]);

  const sendReaction = (toUserId, activityId, reaction) => {
    if (socket) {
      socket.emit('send_reaction', { toUserId, activityId, reaction });
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      currentPlaying,
      friendActivity,
      onlineFriends,
      sendReaction
    }}>
      {children}
    </SocketContext.Provider>
  );
};

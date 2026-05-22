import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [friendActivity, setFriendActivity] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);

  useEffect(() => {
    if (!token || !user) return;

    const socketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
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

    socketInstance.on('new_reaction', (reaction) => {
      // Handle new reaction notification
      console.log('New reaction:', reaction);
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

  const subscribeToFriendActivity = (friendIds) => {
    if (socket && friendIds.length) {
      socket.emit('subscribe_friend_activity', { friendIds });
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      currentPlaying,
      friendActivity,
      onlineFriends,
      sendReaction,
      subscribeToFriendActivity
    }}>
      {children}
    </SocketContext.Provider>
  );
};
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const spotifyService = require('../services/spotifyService');

const onlineUsers = new Map();

const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.userId = user._id;
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    onlineUsers.set(socket.userId.toString(), socket.id);
    
    // Broadcast online status to friends
    socket.broadcast.emit('user_online', { userId: socket.userId });
    
    // Start sending current playing status every 5 seconds
    let intervalId;
    
    const sendCurrentPlaying = async () => {
      try {
        const currentTrack = await spotifyService.getCurrentPlaying(socket.userId);
        if (currentTrack && currentTrack.item) {
          const playingData = {
            userId: socket.userId,
            userName: socket.user.displayName,
            track: {
              name: currentTrack.item.name,
              artist: currentTrack.item.artists[0].name,
              albumImage: currentTrack.item.album.images[0]?.url,
              progress: currentTrack.progress_ms,
              duration: currentTrack.item.duration_ms
            }
          };
          socket.emit('current_playing', playingData);
          socket.broadcast.emit('friend_playing', playingData);
        }
      } catch (error) {
        // User might not be playing anything
      }
    };
    
    intervalId = setInterval(sendCurrentPlaying, 5000);
    
    // Handle friend activity subscription
    socket.on('subscribe_friend_activity', async ({ friendIds }) => {
      socket.join(friendIds.map(id => `friend_${id}`));
    });
    
    // Handle reactions
    socket.on('send_reaction', async ({ toUserId, activityId, reaction }) => {
      const toSocketId = onlineUsers.get(toUserId.toString());
      if (toSocketId) {
        io.to(toSocketId).emit('new_reaction', {
          fromUserId: socket.userId,
          fromUserName: socket.user.displayName,
          activityId,
          reaction
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId.toString());
      clearInterval(intervalId);
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });
};

module.exports = { setupSocketHandlers };
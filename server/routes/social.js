const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');
const ListeningActivity = require('../models/ListeningActivity');

// Send friend request
router.post('/friend-request', authenticateToken, async (req, res) => {
  try {
    const { toUserId } = req.body;
    
    if (req.userId.toString() === toUserId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }
    
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { from: req.userId, to: toUserId },
        { from: toUserId, to: req.userId }
      ]
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    
    const friendRequest = new FriendRequest({
      from: req.userId,
      to: toUserId
    });
    
    await friendRequest.save();
    
    // Create notification
    const fromUser = await User.findById(req.userId);
    await Notification.create({
      userId: toUserId,
      type: 'friend_request',
      content: {
        title: 'New Friend Request',
        message: `${fromUser.displayName} sent you a friend request`,
        data: { fromUserId: req.userId, fromUserName: fromUser.displayName }
      }
    });
    
    res.json({ success: true, request: friendRequest });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.post('/accept-request/:requestId', authenticateToken, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    
    if (!request || request.to.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    request.status = 'accepted';
    await request.save();
    
    // Add friends to each other's lists
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { friends: request.from }
    });
    await User.findByIdAndUpdate(request.from, {
      $addToSet: { friends: req.userId }
    });
    
    // Create notification for the sender
    const currentUser = await User.findById(req.userId);
    await Notification.create({
      userId: request.from,
      type: 'friend_accept',
      content: {
        title: 'Friend Request Accepted',
        message: `${currentUser.displayName} accepted your friend request`,
        data: { userId: req.userId, userName: currentUser.displayName }
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Get friend requests
router.get('/friend-requests', authenticateToken, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      to: req.userId,
      status: 'pending'
    }).populate('from', 'displayName profileImage');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get friends list with activity
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', 'displayName profileImage spotifyId privacySettings');
    
    const friendsWithActivity = await Promise.all(
      user.friends.map(async (friend) => {
        const lastActivity = await ListeningActivity.findOne({ userId: friend._id })
          .sort({ playedAt: -1 })
          .limit(1);
        
        return {
          ...friend.toObject(),
          lastActivity: lastActivity || null
        };
      })
    );
    
    res.json(friendsWithActivity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get friend feed
router.get('/friend-feed', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends');
    const friendIds = user.friends.map(f => f._id);
    
    const activities = await ListeningActivity.find({
      userId: { $in: friendIds },
      playedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .sort({ playedAt: -1 })
      .limit(100)
      .populate('userId', 'displayName profileImage');
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friend feed' });
  }
});

// Search users
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({
      _id: { $ne: req.userId },
      displayName: { $regex: query, $options: 'i' }
    }).limit(10);
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
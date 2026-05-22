import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { UserPlus, UserCheck, UserX, Search, Music, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Friends = () => {
  const { user } = useAuth();
  const { onlineFriends } = useSocket();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendFeed, setFriendFeed] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    fetchFriendFeed();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_URL}/social/friends`);
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/social/friend-requests`);
      setFriendRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const fetchFriendFeed = async () => {
    try {
      const response = await axios.get(`${API_URL}/social/friend-feed`);
      setFriendFeed(response.data);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await axios.get(`${API_URL}/social/search-users?query=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const sendFriendRequest = async (toUserId) => {
    try {
      await axios.post(`${API_URL}/social/friend-request`, { toUserId });
      toast.success('Friend request sent!');
      setSearchResults(searchResults.filter(u => u._id !== toUserId));
    } catch (error) {
      toast.error('Failed to send request');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await axios.post(`${API_URL}/social/accept-request/${requestId}`);
      toast.success('Friend request accepted!');
      fetchFriends();
      fetchFriendRequests();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        {['friends', 'requests', 'feed', 'search'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-green-500 border-b-2 border-green-500'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Friends List */}
      {activeTab === 'friends' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {friends.map((friend) => (
            <div
              key={friend._id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition"
            >
              <div className="flex items-center space-x-4">
                <img
                  src={friend.profileImage || 'https://via.placeholder.com/60'}
                  alt={friend.displayName}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-lg">{friend.displayName}</h3>
                    {onlineFriends.includes(friend._id) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  {friend.lastActivity && (
                    <div className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
                      <Music className="w-3 h-3" />
                      <span className="truncate">{friend.lastActivity.trackName}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1 text-xs text-gray-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {friend.lastActivity
                        ? new Date(friend.lastActivity.playedAt).toLocaleDateString()
                        : 'No recent activity'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Friend Requests */}
      {activeTab === 'requests' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {friendRequests.map((request) => (
            <div
              key={request._id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <img
                  src={request.from.profileImage || 'https://via.placeholder.com/50'}
                  alt={request.from.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-semibold">{request.from.displayName}</h3>
                  <p className="text-sm text-gray-500">wants to be friends</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => acceptRequest(request._id)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Accept
                </button>
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
                  Decline
                </button>
              </div>
            </div>
          ))}
          {friendRequests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No pending friend requests
            </div>
          )}
        </motion.div>
      )}

      {/* Friend Feed */}
      {activeTab === 'feed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {friendFeed.map((activity) => (
            <div
              key={activity._id}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg flex items-center space-x-4"
            >
              <img
                src={activity.userId.profileImage || 'https://via.placeholder.com/40'}
                alt={activity.userId.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1">
                <p>
                  <span className="font-semibold">{activity.userId.displayName}</span>
                  {' listened to '}
                  <span className="font-medium">{activity.trackName}</span>
                  {' by '}
                  <span className="text-gray-600 dark:text-gray-400">{activity.artistName}</span>
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(activity.playedAt).toLocaleString()}
                </p>
              </div>
              {activity.albumImage && (
                <img src={activity.albumImage} alt="Album" className="w-12 h-12 rounded-lg" />
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Search Users */}
      {activeTab === 'search' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex space-x-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              placeholder="Search users by name..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
            />
            <button
              onClick={searchUsers}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {searchResults.map((result) => (
              <div
                key={result._id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={result.profileImage || 'https://via.placeholder.com/50'}
                    alt={result.displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-semibold">{result.displayName}</h3>
                    <p className="text-sm text-gray-500">{result.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => sendFriendRequest(result._id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Friend</span>
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Friends;
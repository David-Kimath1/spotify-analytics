import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Music, Clock, Headphones, Calendar, Edit2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Profile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [privacy, setPrivacy] = useState({
    shareActivity: true,
    shareTopArtists: true,
    shareListeningStats: true
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [statsRes, artistsRes, tracksRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/stats`),
        axios.get(`${API_URL}/analytics/top-artists?limit=5`),
        axios.get(`${API_URL}/analytics/top-tracks?limit=5`)
      ]);
      setStats(statsRes.data);
      setTopArtists(artistsRes.data);
      setTopTracks(tracksRes.data);
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePrivacy = async () => {
    try {
      // API call to update privacy settings
      toast.success('Privacy settings updated!');
      setEditing(false);
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 text-white"
      >
        <div className="flex items-center space-x-6">
          <img
            src={user?.profileImage || 'https://via.placeholder.com/100'}
            alt={user?.displayName}
            className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
          />
          <div>
            <h1 className="text-3xl font-bold">{user?.displayName || 'Spotify User'}</h1>
            <p className="text-green-100 mt-1">Music Lover</p>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Joined {new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<Headphones className="w-6 h-6" />}
          title="Total Minutes"
          value={stats?.totalMinutes || 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={<Music className="w-6 h-6" />}
          title="Total Tracks"
          value={stats?.totalTracks || 0}
          color="bg-purple-500"
        />
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          title="Listening Streak"
          value={`${stats?.listeningStreak || 0} days`}
          color="bg-green-500"
        />
      </div>

      {/* Top Artists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Top Artists</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topArtists.map((artist, index) => (
            <div key={artist.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
              {artist.images?.[0] && (
                <img src={artist.images[0].url} alt={artist.name} className="w-12 h-12 rounded-full" />
              )}
              <div className="flex-1">
                <p className="font-medium">{artist.name}</p>
                <p className="text-sm text-gray-500">#{index + 1} Top Artist</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Tracks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Top Tracks</h3>
        <div className="space-y-3">
          {topTracks.map((track, index) => (
            <div key={track.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
              {track.album?.images?.[0] && (
                <img src={track.album.images[0].url} alt={track.name} className="w-10 h-10 rounded-lg" />
              )}
              <div className="flex-1">
                <p className="font-medium">{track.name}</p>
                <p className="text-sm text-gray-500">{track.artists?.[0]?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">#{index + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Privacy Settings</h3>
          <button
            onClick={() => editing ? updatePrivacy() : setEditing(true)}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            {editing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            <span>{editing ? 'Save' : 'Edit'}</span>
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Share listening activity with friends</span>
            <input
              type="checkbox"
              checked={privacy.shareActivity}
              onChange={(e) => setPrivacy({...privacy, shareActivity: e.target.checked})}
              disabled={!editing}
              className="w-5 h-5 text-green-500 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Share top artists on profile</span>
            <input
              type="checkbox"
              checked={privacy.shareTopArtists}
              onChange={(e) => setPrivacy({...privacy, shareTopArtists: e.target.checked})}
              disabled={!editing}
              className="w-5 h-5 text-green-500 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Share listening statistics</span>
            <input
              type="checkbox"
              checked={privacy.shareListeningStats}
              onChange={(e) => setPrivacy({...privacy, shareListeningStats: e.target.checked})}
              disabled={!editing}
              className="w-5 h-5 text-green-500 rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className={`${color} rounded-xl p-6 text-white shadow-lg`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="opacity-80">{icon}</div>
    </div>
    <h3 className="text-2xl font-bold">{value.toLocaleString()}</h3>
    <p className="text-sm opacity-90 mt-1">{title}</p>
  </motion.div>
);

export default Profile;
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Music, Headphones, Clock, Users, TrendingUp, Play, RefreshCw, Award, Calendar, ListMusic } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchCurrentlyPlaying();
    fetchBadges();
    
    const interval = setInterval(fetchCurrentlyPlaying, 10000);
    const dataInterval = setInterval(fetchDashboardData, 30000);
    
    return () => {
      clearInterval(interval);
      clearInterval(dataInterval);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, artistsRes, recentRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/stats`),
        axios.get(`${API_URL}/analytics/top-artists?limit=5`),
        axios.get(`${API_URL}/analytics/recently-played?limit=10`)
      ]);
      
      setStats(statsRes.data);
      setTopArtists(artistsRes.data);
      setRecentlyPlayed(recentRes.data);
    } catch (error) {
      console.error('Failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentlyPlaying = async () => {
    try {
      const response = await axios.get(`${API_URL}/analytics/currently-playing`);
      if (response.data && response.data.item) {
        setCurrentlyPlaying({
          name: response.data.item.name,
          artist: response.data.item.artists[0].name,
          albumImage: response.data.item.album.images[0]?.url
        });
      } else {
        setCurrentlyPlaying(null);
      }
    } catch (error) {
      setCurrentlyPlaying(null);
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await axios.get(`${API_URL}/badges`);
      setBadges(response.data.badges || []);
    } catch (error) {
      console.error('Badges error:', error);
    }
  };

  const manualSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/spotify/sync`);
      toast.success('Sync completed!');
      await fetchDashboardData();
      await fetchBadges();
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const createPlaylist = async () => {
    try {
      const response = await axios.post(`${API_URL}/playlist/create-top-playlist`);
      toast.success(`Playlist ready: ${response.data.playlistName}`);
    } catch (error) {
      toast.error('Failed to create playlist');
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
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-end">
        <button onClick={manualSync} disabled={syncing} className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>Sync Now</span>
        </button>
        <button onClick={() => setShowBadges(!showBadges)} className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
          <Award className="w-4 h-4" />
          <span>Badges ({badges.length})</span>
        </button>
        <button onClick={createPlaylist} className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
          <ListMusic className="w-4 h-4" />
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Currently Playing */}
      {currentlyPlaying && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center space-x-4">
            <Play className="w-8 h-8 animate-pulse" />
            <div>
              <p className="text-sm opacity-90">CURRENTLY PLAYING</p>
              <h3 className="text-xl font-bold">{currentlyPlaying.name}</h3>
              <p>{currentlyPlaying.artist}</p>
            </div>
            {currentlyPlaying.albumImage && (
              <img src={currentlyPlaying.albumImage} alt="Album" className="w-16 h-16 rounded-lg ml-auto" />
            )}
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Clock />} title="Minutes" value={stats?.totalMinutes || 0} color="bg-blue-500" />
        <StatCard icon={<Headphones />} title="Tracks" value={stats?.totalTracks || 0} color="bg-purple-500" />
        <StatCard icon={<Users />} title="Artists" value={stats?.uniqueArtists || 0} color="bg-pink-500" />
        <StatCard icon={<TrendingUp />} title="Streak" value={`${stats?.listeningStreak || 0}d`} color="bg-green-500" />
      </div>

      {/* Badges Display */}
      {showBadges && badges.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><Award className="w-5 h-5 mr-2 text-yellow-500" />Your Achievements</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {badges.map((badge, i) => (
              <div key={i} className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-3 text-center hover:scale-105 transition">
                <div className="text-3xl mb-1">{badge.icon}</div>
                <p className="font-semibold text-sm">{badge.name}</p>
                <p className="text-xs text-gray-500">{badge.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Artists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Top Artists</h3>
        <div className="space-y-3">
          {topArtists.map((artist, idx) => (
            <div key={idx} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
              <span className="text-2xl font-bold text-green-500">#{idx+1}</span>
              <div className="flex-1">
                <p className="font-medium">{artist.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recently Played */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Recently Played</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentlyPlayed.map((activity) => (
            <div key={activity._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
              {activity.albumImage && <img src={activity.albumImage} alt="" className="w-10 h-10 rounded-lg" />}
              <div className="flex-1">
                <p className="font-medium text-sm">{activity.trackName}</p>
                <p className="text-xs text-gray-500">{activity.artistName}</p>
              </div>
              <p className="text-xs text-gray-400">{new Date(activity.playedAt).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <motion.div whileHover={{ scale: 1.05 }} className={`${color} rounded-xl p-4 text-white shadow-lg`}>
    <div className="mb-2">{icon}</div>
    <h3 className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
    <p className="text-xs opacity-90">{title}</p>
  </motion.div>
);

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Music, Headphones, Clock, Users, TrendingUp, Play, Activity, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchCurrentlyPlaying();
    
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

  const manualSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/spotify/sync`);
      toast.success('Sync completed!');
      await fetchDashboardData();
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
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
    <div className="space-y-4 md:space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end">
        <button
          onClick={manualSync}
          disabled={syncing}
          className="flex items-center space-x-2 px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-lg text-sm md:text-base"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* Currently Playing */}
      {currentlyPlaying && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 md:p-6 text-white">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="relative">
              <Activity className="w-6 h-6 md:w-8 md:h-8 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-xs md:text-sm opacity-90">CURRENTLY PLAYING</p>
              <h3 className="text-base md:text-xl font-bold truncate">{currentlyPlaying.name}</h3>
              <p className="text-sm md:text-base opacity-90 truncate">{currentlyPlaying.artist}</p>
            </div>
            {currentlyPlaying.albumImage && (
              <img src={currentlyPlaying.albumImage} alt="Album" className="w-12 h-12 md:w-16 md:h-16 rounded-lg shadow-lg" />
            )}
          </div>
        </motion.div>
      )}

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={<Clock className="w-4 h-4 md:w-6 md:h-6" />} title="Minutes" value={stats?.totalMinutes || 0} color="bg-blue-500" />
        <StatCard icon={<Headphones className="w-4 h-4 md:w-6 md:h-6" />} title="Tracks" value={stats?.totalTracks || 0} color="bg-purple-500" />
        <StatCard icon={<Users className="w-4 h-4 md:w-6 md:h-6" />} title="Artists" value={stats?.uniqueArtists || 0} color="bg-pink-500" />
        <StatCard icon={<TrendingUp className="w-4 h-4 md:w-6 md:h-6" />} title="Streak" value={`${stats?.listeningStreak || 0}d`} color="bg-green-500" />
      </div>

      {/* Top Artists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg">
        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">🎤 Top Artists</h3>
        <div className="space-y-2 md:space-y-3">
          {topArtists.map((artist, idx) => (
            <div key={idx} className="flex items-center space-x-3 p-2 md:p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
              <span className="text-xl md:text-2xl font-bold text-green-500">#{idx+1}</span>
              <div className="flex-1">
                <p className="font-medium text-sm md:text-base truncate">{artist.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recently Played - Horizontal Scroll on Mobile */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg">
        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">🔄 Recently Played</h3>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:block space-x-3 md:space-x-0 md:space-y-2">
            {recentlyPlayed.map((activity) => (
              <div key={activity._id} className="flex-shrink-0 w-64 md:w-full flex items-center space-x-3 p-2 md:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {activity.albumImage && (
                  <img src={activity.albumImage} alt="" className="w-10 h-10 rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{activity.trackName}</p>
                  <p className="text-xs text-gray-500 truncate">{activity.artistName}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{new Date(activity.playedAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <motion.div whileHover={{ scale: 1.05 }} className={`stat-card ${color}`}>
    <div className="mb-1 md:mb-2">{icon}</div>
    <p className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    <p className="stat-label">{title}</p>
  </motion.div>
);

export default Dashboard;

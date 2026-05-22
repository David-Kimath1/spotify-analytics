import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Music, Headphones, Clock, Users, TrendingUp, Calendar } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentPlaying, friendActivity } = useSocket();
  const [stats, setStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, artistsRes, tracksRes, recentRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/stats?timeRange=${timeRange}`),
        axios.get(`${API_URL}/analytics/top-artists?limit=10`),
        axios.get(`${API_URL}/analytics/top-tracks?limit=10`),
        axios.get(`${API_URL}/analytics/recently-played?limit=20`)
      ]);
      
      setStats(statsRes.data);
      setTopArtists(artistsRes.data);
      setTopTracks(tracksRes.data);
      setRecentlyPlayed(recentRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const barChartData = {
    labels: stats?.topArtists?.map(a => a.name) || [],
    datasets: [
      {
        label: 'Plays',
        data: stats?.topArtists?.map(a => a.plays) || [],
        backgroundColor: 'rgba(29, 185, 84, 0.6)',
        borderColor: 'rgba(29, 185, 84, 1)',
        borderWidth: 1
      }
    ]
  };

  const genreData = {
    labels: stats?.topGenres || [],
    datasets: [
      {
        data: stats?.genreDistribution || [],
        backgroundColor: [
          '#1DB954',
          '#191414',
          '#FF6B6B',
          '#4ECDC4',
          '#45B7D1',
          '#96CEB4'
        ]
      }
    ]
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
      {/* Currently Playing */}
      {currentPlaying && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="animate-pulse">
                <Music className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm opacity-90">Currently Playing</p>
                <h3 className="text-xl font-bold">{currentPlaying.track?.name}</h3>
                <p className="text-sm opacity-90">{currentPlaying.track?.artist}</p>
              </div>
            </div>
            {currentPlaying.track?.albumImage && (
              <img
                src={currentPlaying.track.albumImage}
                alt="Album art"
                className="w-16 h-16 rounded-lg shadow-lg"
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          title="Total Minutes"
          value={stats?.totalMinutes || 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={<Headphones className="w-6 h-6" />}
          title="Total Tracks"
          value={stats?.totalTracks || 0}
          color="bg-purple-500"
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          title="Unique Artists"
          value={stats?.uniqueArtists || 0}
          color="bg-pink-500"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Listening Streak"
          value={`${stats?.listeningStreak || 0} days`}
          color="bg-green-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
        >
          <h3 className="text-lg font-semibold mb-4">Top Artists</h3>
          <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
        >
          <h3 className="text-lg font-semibold mb-4">Genre Distribution</h3>
          <Doughnut data={genreData} options={{ responsive: true, maintainAspectRatio: true }} />
        </motion.div>
      </div>

      {/* Top Tracks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Top Tracks</h3>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
        <div className="space-y-3">
          {topTracks.map((track, index) => (
            <div key={track.id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
              <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
              {track.album.images[0] && (
                <img src={track.album.images[0].url} alt={track.name} className="w-12 h-12 rounded-lg" />
              )}
              <div className="flex-1">
                <p className="font-medium">{track.name}</p>
                <p className="text-sm text-gray-500">{track.artists[0].name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{track.popularity}% popularity</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recently Played */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
      >
        <h3 className="text-lg font-semibold mb-4">Recently Played</h3>
        <div className="space-y-3">
          {recentlyPlayed.slice(0, 10).map((activity) => (
            <div key={activity._id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
              {activity.albumImage && (
                <img src={activity.albumImage} alt={activity.trackName} className="w-10 h-10 rounded-lg" />
              )}
              <div className="flex-1">
                <p className="font-medium">{activity.trackName}</p>
                <p className="text-sm text-gray-500">{activity.artistName}</p>
              </div>
              <p className="text-sm text-gray-400">
                {new Date(activity.playedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
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

export default Dashboard;
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Calendar, Download, Share2, TrendingUp, Music, Headphones, Award, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const Wrapped = () => {
  const [period, setPeriod] = useState('weekly');
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecap();
  }, [period]);

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/wrapped/recap/${period}?preview=true`);
      setRecap(response.data);
    } catch (error) {
      console.error('Failed to fetch recap:', error);
      toast.error('Failed to load wrapped data');
    } finally {
      setLoading(false);
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
      {/* Period Selector */}
      <div className="flex justify-center space-x-4">
        {['weekly', 'monthly', 'yearly'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-6 py-2 rounded-lg font-medium capitalize transition ${
              period === p
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {recap && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          {/* Preview Notice */}
          {recap.isPreview && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {recap.data.message || 'Preview mode - keep listening for full wrapped!'}
                </p>
              </div>
            </div>
          )}

          {/* Header Card */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 text-white text-center">
            <h2 className="text-3xl font-bold mb-2">
              {recap.isPreview ? 'Preview: ' : ''}Your {period} Wrapped
            </h2>
            <p className="text-purple-100">
              {recap.data.totalTracks > 0 
                ? `${recap.data.totalTracks} tracks analyzed`
                : 'Listen to music to see your stats!'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <Headphones className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-3xl font-bold">{recap.data.totalMinutes || 0}</h3>
              <p className="text-gray-500">Total Minutes Listened</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <Music className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-3xl font-bold">{recap.data.totalTracks || 0}</h3>
              <p className="text-gray-500">Total Tracks Played</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <Award className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-3xl font-bold">{recap.data.uniqueArtists || 0}</h3>
              <p className="text-gray-500">Unique Artists</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <TrendingUp className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-3xl font-bold">{recap.data.listeningStreak || 0}</h3>
              <p className="text-gray-500">Active Days</p>
            </div>
          </div>

          {/* Top Artists */}
          {recap.data.topArtists?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 text-center">Your Top Artists</h3>
              <div className="space-y-3">
                {recap.data.topArtists.map((artist, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-green-500">#{index + 1}</span>
                      <span className="font-medium">{artist.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{artist.plays} plays</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Tracks */}
          {recap.data.topTracks?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 text-center">Your Top Tracks</h3>
              <div className="space-y-3">
                {recap.data.topTracks.map((track, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {track.albumImage && (
                      <img src={track.albumImage} alt={track.trackName} className="w-10 h-10 rounded-lg" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{track.trackName}</p>
                      <p className="text-sm text-gray-500">{track.artistName}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-500">{track.plays} plays</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {recap.data.totalTracks === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-lg text-center">
              <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No data yet</h3>
              <p className="text-gray-500">
                Listen to some music on Spotify, then click "Sync Now" on your dashboard.
                <br />
                Your stats will appear here within 5-10 minutes.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Wrapped;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Award, Share2, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const Badges = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const response = await axios.get(`${API_URL}/badges`);
      setBadges(response.data.badges);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareBadges = () => {
    const badgeText = badges.map(b => `${b.icon} ${b.name}`).join('\n');
    const shareText = `🎵 My Spotify Achievements!\n\n${badgeText}\n\nMade with Spotify Analytics App`;
    
    if (navigator.share) {
      navigator.share({
        title: 'My Spotify Badges',
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Badges copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No badges yet. Keep listening to unlock achievements!</p>
        <p className="text-sm text-gray-400 mt-2">Listen more, explore new artists, and maintain streaks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Your Achievements</h3>
          <span className="text-sm text-gray-500">({badges.length})</span>
        </div>
        <button
          onClick={shareBadges}
          className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge, index) => (
          <motion.div
            key={badge.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className={`${badge.color} rounded-xl p-4 text-white shadow-lg cursor-pointer`}
            onClick={() => toast.success(`${badge.name}: ${badge.description}`)}
          >
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{badge.icon}</span>
              <div>
                <h4 className="font-semibold">{badge.name}</h4>
                <p className="text-xs opacity-90">{badge.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Badges;
